import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Download,
  Filter,
  DollarSign,
  Briefcase,
  UserCheck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  RefreshCcw,
  Truck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dbModule } from '../../services/dbModule';
import { exportToCSV } from '../../utils/exportHelpers';

export type NewReportTab = 'outstanding_po' | 'mr_advance_eligible' | 'mr_apmc_details' | 'mr_delivery_claim';

interface NewCustomReportsViewProps {
  initialTab?: NewReportTab;
}

export const NewCustomReportsView: React.FC<NewCustomReportsViewProps> = ({ initialTab = 'outstanding_po' }) => {
  const [activeSubReport, setActiveSubReport] = useState<NewReportTab>(initialTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Report 1: Outstanding PO State
  const [poList, setPoList] = useState<any[]>([]);
  const [poGroupBy, setPoGroupBy] = useState<'broker' | 'supplier' | 'area' | 'all'>('broker');
  const [poStatusFilter, setPoStatusFilter] = useState<'ALL' | 'PENDING' | 'PARTIAL'>('ALL');

  // Report 2: MR Advance Eligible State
  const [advanceMrList, setAdvanceMrList] = useState<any[]>([]);

  // Report 3: MR APMC Details State
  const [apmcList, setApmcList] = useState<any[]>([]);

  // Report 4: MR Delivery Claim State
  const [deliveryClaimList, setDeliveryClaimList] = useState<any[]>([]);

  // Database Schema Help Drawer / Banner state
  const [showSchemaInfo, setShowSchemaInfo] = useState<boolean>(true);

  // Load report data from database
  const loadReportsData = async () => {
    setLoading(true);
    try {
      if (supabase) {
        // Fetch POs & Arrivals for Outstanding PO Report & Advance Report
        const [poRes, faRes, mrSettRes, payMasterRes, saudaCpRes] = await Promise.all([
          supabase.from('purchase_master').select('*').order('created_at', { ascending: false }),
          supabase.from('final_arrival').select('*').order('date', { ascending: false }),
          supabase.from('mr_settlement_master').select('*').order('created_at', { ascending: false }),
          supabase.from('payment_master').select('*').order('created_at', { ascending: false }),
          supabase.from('sauda_check_point').select('*').order('created_at', { ascending: false })
        ]);

        const rawPos = poRes.data || [];
        const rawFa = faRes.data || [];
        const rawSettlements = mrSettRes.data || [];
        const rawPayments = payMasterRes.data || [];
        const rawCheckpoints = saudaCpRes.data || [];

        // Build Arrival & Settlement Weight Aggregates per PO
        const poReceivedMap: Record<string, number> = {};
        rawFa.forEach((fa: any) => {
          const po = (fa.po_no || '').trim().toUpperCase();
          if (!po) return;
          const wtMt = Number(fa.supplier_net_weight) || Number(fa.electronic_net_weight) || Number(fa.challan_material_weight) || (Number(fa.weight_qtl) ? Number(fa.weight_qtl) / 10 : 0);
          poReceivedMap[po] = (poReceivedMap[po] || 0) + wtMt;
        });

        // Map Outstanding POs
        const combinedPoList: any[] = [];

        // Process purchase_master records
        rawPos.forEach((po: any) => {
          const poNo = (po.po_no || po.po_number || '').trim().toUpperCase();
          if (!poNo) return;
          const totalQty = Number(po.total_qty_mt) || Number(po.qty_mt) || Number(po.quantity) || 0;
          const rcvdQty = poReceivedMap[poNo] || Number(po.received_qty_mt) || 0;
          const pendingQty = Math.max(0, totalQty - rcvdQty);
          const rate = Number(po.rate_qntl) || Number(po.rate_mt) || Number(po.b_rate) || Number(po.rate) || 0;
          const pendingValue = pendingQty * (rate > 2000 ? rate * 10 : rate); // Rate in Rs/MT or Rs/Qtl

          let status: 'PENDING' | 'PARTIAL' | 'COMPLETED' = 'PENDING';
          if (rcvdQty >= totalQty && totalQty > 0) status = 'COMPLETED';
          else if (rcvdQty > 0 && rcvdQty < totalQty) status = 'PARTIAL';

          if (pendingQty > 0.01 || status !== 'COMPLETED') {
            combinedPoList.push({
              poNo,
              poDate: po.po_date || po.date || po.created_at || '',
              supplier: (po.supplier || po.supplier_name || 'UNKNOWN SUPPLIER').toUpperCase().trim(),
              broker: (po.broker || po.broker_name || 'DIRECT').toUpperCase().trim(),
              area: (po.area || po.agency || 'MAIN AREA').toUpperCase().trim(),
              agency: (po.agency || '-').toUpperCase().trim(),
              totalQty,
              rcvdQty,
              pendingQty,
              rate,
              pendingValue,
              status
            });
          }
        });

        // Also process sauda_check_point records if missing in purchase_master
        rawCheckpoints.forEach((cp: any) => {
          const poNo = (cp.po_no || cp.session || '').trim().toUpperCase();
          if (!poNo || combinedPoList.some(p => p.poNo === poNo)) return;
          const totalQty = Number(cp.quantity_mt) || Number(cp.quantity) || 0;
          const rcvdQty = poReceivedMap[poNo] || 0;
          const pendingQty = Math.max(0, totalQty - rcvdQty);
          const rate = Number(cp.b_rate) || Number(cp.rate) || 0;
          const pendingValue = pendingQty * (rate > 2000 ? rate * 10 : rate);

          let status: 'PENDING' | 'PARTIAL' | 'COMPLETED' = 'PENDING';
          if (rcvdQty >= totalQty && totalQty > 0) status = 'COMPLETED';
          else if (rcvdQty > 0 && rcvdQty < totalQty) status = 'PARTIAL';

          if (pendingQty > 0.01 || status !== 'COMPLETED') {
            combinedPoList.push({
              poNo,
              poDate: cp.date || cp.created_at || '',
              supplier: (cp.supplier || cp.supplier_name || 'UNKNOWN SUPPLIER').toUpperCase().trim(),
              broker: (cp.broker || cp.broker_name || 'DIRECT').toUpperCase().trim(),
              area: (cp.area || cp.agency || 'MAIN AREA').toUpperCase().trim(),
              agency: (cp.agency || '-').toUpperCase().trim(),
              totalQty,
              rcvdQty,
              pendingQty,
              rate,
              pendingValue,
              status
            });
          }
        });

        setPoList(combinedPoList);

        // Process MR Eligible for Advance
        // Match final_arrival entries with payments / settlements
        const advanceMrRecords: any[] = [];
        rawFa.forEach((fa: any) => {
          const mrNo = fa.mr_no || fa.final_arrival_no || fa.arrival_no;
          if (!mrNo) return;

          // Find settlement or payment record
          const sett = rawSettlements.find((s: any) => s.mr_no === mrNo) || {};
          const pay = rawPayments.find((p: any) => p.mr_no === mrNo) || {};

          const arrWtMt = Number(fa.supplier_net_weight) || Number(fa.electronic_net_weight) || Number(fa.challan_material_weight) || (Number(fa.weight_qtl) ? Number(fa.weight_qtl) / 10 : 0);
          const arrWtQtl = arrWtMt * 10;
          const rateQtl = Number(sett.rate_qntl) || Number(fa.rate_value) || Number(pay.rate) || 12000;
          const materialValue = Number(sett.val_material_value || sett.summary_material_value) || (arrWtQtl * rateQtl);

          // Standard Advance eligibility: 80% or 90% of Material Value
          const eligibleAdvancePct = 90;
          const eligibleAdvanceAmt = (materialValue * eligibleAdvancePct) / 100;
          const paidAdvanceAmt = Number(sett.final_on_ac_adv) || Number(pay.paid_amount) || Number(pay.total_advance) || Number(sett.less_advance_amount) || 0;
          const pendingAdvancePayable = Math.max(0, eligibleAdvanceAmt - paidAdvanceAmt);

          advanceMrRecords.push({
            mrNo,
            arrivalDate: fa.date || fa.arrival_date || fa.created_at || '',
            poNo: fa.po_no || '-',
            supplier: (fa.supplier || fa.challan_supplier || sett.supplier || 'UNKNOWN SUPPLIER').toUpperCase().trim(),
            broker: (fa.broker || sett.broker || 'DIRECT').toUpperCase().trim(),
            lorryNumber: fa.lorry_number || fa.vehicle_no || '-',
            arrWtMt,
            arrWtQtl,
            materialValue,
            eligibleAdvancePct,
            eligibleAdvanceAmt,
            paidAdvanceAmt,
            pendingAdvancePayable,
            advanceStatus: pendingAdvancePayable > 0 ? 'ELIGIBLE_PENDING' : 'FULLY_ADVANCED'
          });
        });
        setAdvanceMrList(advanceMrRecords);

        // Process MR Wise APMC Details
        const apmcRecords: any[] = [];
        rawSettlements.forEach((s: any) => {
          const mrNo = s.mr_no;
          if (!mrNo) return;
          const fa = rawFa.find((f: any) => f.mr_no === mrNo || f.final_arrival_no === mrNo) || {};

          const matVal = Number(s.val_material_value || s.summary_material_value) || 0;
          const challanApmc = Number(s.arival_apmc_fees) || Number(fa.arival_apmc_fees) || Number(fa.apmc_fees) || 0;
          const actualApmc = Number(s.actual_apmc_fees) > 0 ? Number(s.actual_apmc_fees) : Math.round(matVal * 0.01);
          const apmcDiff = Number(s.final_apmc_fees) > 0 ? Number(s.final_apmc_fees) : Math.max(0, actualApmc - challanApmc);

          apmcRecords.push({
            mrNo,
            settDate: s.sett_date || s.mr_date || s.created_at || '',
            poNo: s.po_no || fa.po_no || '-',
            supplier: (s.supplier || fa.supplier || 'UNKNOWN').toUpperCase().trim(),
            broker: (s.broker || fa.broker || 'DIRECT').toUpperCase().trim(),
            materialValue: matVal,
            challanApmc,
            actualApmc,
            apmcDiff
          });
        });
        setApmcList(apmcRecords);

        // Process MR Wise Delivery Claim
        const deliveryClaimRecords: any[] = [];
        rawSettlements.forEach((s: any) => {
          const mrNo = s.mr_no;
          if (!mrNo) return;
          const claimAmt = Number(s.summary_delivery_claim) || Number(s.val_ex_short) || 0;
          const detentionDays = Number(s.detention_days) || 0;

          deliveryClaimRecords.push({
            mrNo,
            mrDate: s.mr_date || s.sett_date || s.created_at || '',
            poNo: s.po_no || '-',
            poDate: s.po_date || '',
            arrivalDate: s.arrival_date || s.mr_date || '',
            supplier: (s.supplier || 'UNKNOWN').toUpperCase().trim(),
            broker: (s.broker || 'DIRECT').toUpperCase().trim(),
            detentionDays,
            claimAmt,
            remarks: s.remarks || (claimAmt > 0 ? 'Late Arrival Delivery Penalty' : 'On-Time Arrival')
          });
        });
        setDeliveryClaimList(deliveryClaimRecords);
      }
    } catch (err) {
      console.error('Failed to load custom reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportsData();
  }, []);

  // Filter Outstanding PO Records
  const filteredPoList = useMemo(() => {
    return poList.filter(po => {
      if (poStatusFilter !== 'ALL' && po.status !== poStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          po.poNo.toLowerCase().includes(q) ||
          po.supplier.toLowerCase().includes(q) ||
          po.broker.toLowerCase().includes(q) ||
          po.area.toLowerCase().includes(q) ||
          po.agency.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [poList, poStatusFilter, searchQuery]);

  // Grouped Outstanding POs (Broker / Party / Area Wise)
  const groupedPoSummary = useMemo(() => {
    const map: Record<string, { key: string; totalPoCount: number; totalQty: number; rcvdQty: number; pendingQty: number; pendingValue: number }> = {};

    filteredPoList.forEach(item => {
      const keyVal = poGroupBy === 'broker' ? item.broker : poGroupBy === 'supplier' ? item.supplier : poGroupBy === 'area' ? item.area : item.poNo;
      if (!map[keyVal]) {
        map[keyVal] = { key: keyVal, totalPoCount: 0, totalQty: 0, rcvdQty: 0, pendingQty: 0, pendingValue: 0 };
      }
      map[keyVal].totalPoCount += 1;
      map[keyVal].totalQty += item.totalQty;
      map[keyVal].rcvdQty += item.rcvdQty;
      map[keyVal].pendingQty += item.pendingQty;
      map[keyVal].pendingValue += item.pendingValue;
    });

    return Object.values(map).sort((a, b) => b.pendingQty - a.pendingQty);
  }, [filteredPoList, poGroupBy]);

  // Filter Advance Eligible MR List
  const filteredAdvanceMrList = useMemo(() => {
    return advanceMrList.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.mrNo.toLowerCase().includes(q) ||
          item.poNo.toLowerCase().includes(q) ||
          item.supplier.toLowerCase().includes(q) ||
          item.broker.toLowerCase().includes(q) ||
          item.lorryNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [advanceMrList, searchQuery]);

  // Filter APMC Details List
  const filteredApmcList = useMemo(() => {
    return apmcList.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.mrNo.toLowerCase().includes(q) ||
          item.poNo.toLowerCase().includes(q) ||
          item.supplier.toLowerCase().includes(q) ||
          item.broker.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [apmcList, searchQuery]);

  // Filter Delivery Claim List
  const filteredDeliveryClaimList = useMemo(() => {
    return deliveryClaimList.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.mrNo.toLowerCase().includes(q) ||
          item.poNo.toLowerCase().includes(q) ||
          item.supplier.toLowerCase().includes(q) ||
          item.broker.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [deliveryClaimList, searchQuery]);

  // CSV Export for active sub-report
  const handleExportCSV = () => {
    if (activeSubReport === 'outstanding_po') {
      const headers = ['Group Key / PO', 'Total POs', 'Total Qty (MT)', 'Received Qty (MT)', 'Pending Qty (MT)', 'Pending Value (Rs)'];
      const rows = groupedPoSummary.map(g => [g.key, g.totalPoCount, g.totalQty.toFixed(2), g.rcvdQty.toFixed(2), g.pendingQty.toFixed(2), g.pendingValue.toFixed(2)]);
      exportToCSV(`Outstanding_PO_List_${poGroupBy}_wise.csv`, headers, rows);
    } else if (activeSubReport === 'mr_advance_eligible') {
      const headers = ['MR No', 'Arrival Date', 'PO No', 'Supplier', 'Broker', 'Lorry No', 'Arr Wt (MT)', 'Est. Material Value (Rs)', 'Eligible Adv (Rs)', 'Paid Adv (Rs)', 'Pending Adv Payable (Rs)', 'Status'];
      const rows = filteredAdvanceMrList.map(r => [r.mrNo, r.arrivalDate, r.poNo, r.supplier, r.broker, r.lorryNumber, r.arrWtMt.toFixed(2), r.materialValue.toFixed(2), r.eligibleAdvanceAmt.toFixed(2), r.paidAdvanceAmt.toFixed(2), r.pendingAdvancePayable.toFixed(2), r.advanceStatus]);
      exportToCSV('MR_Eligible_For_Advance_Report.csv', headers, rows);
    } else if (activeSubReport === 'mr_apmc_details') {
      const headers = ['MR No', 'Settlement Date', 'PO No', 'Supplier', 'Broker', 'Material Value (Rs)', 'Challan APMC (Rs)', 'Actual APMC 1% (Rs)', 'APMC Deduction Diff (Rs)'];
      const rows = filteredApmcList.map(r => [r.mrNo, r.settDate, r.poNo, r.supplier, r.broker, r.materialValue.toFixed(2), r.challanApmc.toFixed(2), r.actualApmc.toFixed(2), r.apmcDiff.toFixed(2)]);
      exportToCSV('MR_Wise_APMC_Details_Report.csv', headers, rows);
    } else if (activeSubReport === 'mr_delivery_claim') {
      const headers = ['MR No', 'MR Date', 'PO No', 'PO Date', 'Arrival Date', 'Supplier', 'Broker', 'Detention/Delay Days', 'Delivery Claim Amount (Rs)', 'Remarks'];
      const rows = filteredDeliveryClaimList.map(r => [r.mrNo, r.mrDate, r.poNo, r.poDate, r.arrivalDate, r.supplier, r.broker, r.detentionDays, r.claimAmt.toFixed(2), r.remarks]);
      exportToCSV('MR_Wise_Delivery_Claim_Report.csv', headers, rows);
    }
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">
      
      {/* ================= SUB-REPORT NAVIGATION TABS ================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3 rounded-2xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubReport('outstanding_po')}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 ${
              activeSubReport === 'outstanding_po'
                ? 'bg-gradient-to-r from-[#D94B5A] to-[#E85A5A] text-white shadow-md border border-[#F06D6C]'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>1. Outstanding P.O List</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubReport('mr_advance_eligible')}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 ${
              activeSubReport === 'mr_advance_eligible'
                ? 'bg-gradient-to-r from-[#D94B5A] to-[#E85A5A] text-white shadow-md border border-[#F06D6C]'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>2. MR Eligible for Advance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubReport('mr_apmc_details')}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 ${
              activeSubReport === 'mr_apmc_details'
                ? 'bg-gradient-to-r from-[#D94B5A] to-[#E85A5A] text-white shadow-md border border-[#F06D6C]'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>3. MR Wise APMC Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubReport('mr_delivery_claim')}
            className={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 ${
              activeSubReport === 'mr_delivery_claim'
                ? 'bg-gradient-to-r from-[#D94B5A] to-[#E85A5A] text-white shadow-md border border-[#F06D6C]'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>4. MR Wise Delivery Claim</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSchemaInfo(!showSchemaInfo)}
            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            title="View Database Table Source Mapping"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{showSchemaInfo ? 'Hide Schema Mapping' : 'View DB Tables Source'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ================= DATABASE TABLE SOURCE SCHEMA MAPPING BANNER ================= */}
      {showSchemaInfo && (
        <div className="bg-slate-900 text-slate-200 border border-amber-500/40 p-4 rounded-2xl shadow-xl text-xs space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center gap-2 font-black text-amber-400 text-sm">
              <Database className="w-4 h-4 text-amber-400" />
              <span>DATABASE TABLE SOURCE MAPPING GUIDE FOR THESE 4 REPORTS</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold uppercase">
              Database Schema Guide
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1">
              <span className="font-bold text-rose-400">1. Outstanding P.O List Report</span>
              <p className="text-slate-300 font-sans text-[11px]">
                • <strong className="text-amber-200 font-mono">purchase_master</strong> (or <strong className="text-amber-200 font-mono">sauda_check_point</strong>): Holds Contracted POs (<code className="text-emerald-300">po_no, po_date, supplier, broker, area, agency, total_qty_mt, rate_qntl</code>).<br />
                • <strong className="text-amber-200 font-mono">final_arrival</strong>: Sum of received material (<code className="text-emerald-300">supplier_net_weight, electronic_net_weight, challan_material_weight</code>) per <code className="text-emerald-300">po_no</code>.<br />
                • <strong className="text-amber-200 font-mono">Calculated Fields</strong>: <code className="text-sky-300">Pending Qty = Total PO Qty - Received Qty</code>; Status = Pending / Partial.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1">
              <span className="font-bold text-rose-400">2. List of MR Eligible for Advance</span>
              <p className="text-slate-300 font-sans text-[11px]">
                • <strong className="text-amber-200 font-mono">final_arrival</strong>: Stores Arrival & MR Details (<code className="text-emerald-300">mr_no, date, po_no, supplier, broker, lorry_number, supplier_net_weight</code>).<br />
                • <strong className="text-amber-200 font-mono">mr_settlement_master / payment_master</strong>: Stores Advance Paid (<code className="text-emerald-300">final_on_ac_adv, on_account_Effect, paid_amount</code>).<br />
                • <strong className="text-amber-200 font-mono">Calculated Fields</strong>: <code className="text-sky-300">Eligible Adv (90% of Material Val) - Paid Advance = Pending Advance Payable</code>.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1">
              <span className="font-bold text-rose-400">3. MR Wise APMC Details Report</span>
              <p className="text-slate-300 font-sans text-[11px]">
                • <strong className="text-amber-200 font-mono">mr_settlement_master</strong>: Contains APMC Cess records (<code className="text-emerald-300">mr_no, sett_date, po_no, supplier, broker, val_material_value</code>).<br />
                • <strong className="text-amber-200 font-mono">APMC Columns</strong>: <code className="text-emerald-300">arival_apmc_fees</code> (Challan APMC), <code className="text-emerald-300">actual_apmc_fees</code> (1% Actual), <code className="text-emerald-300">final_apmc_fees</code> (APMC Settlement Deduction).
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1">
              <span className="font-bold text-rose-400">4. MR Wise Delivery Claim Report</span>
              <p className="text-slate-300 font-sans text-[11px]">
                • <strong className="text-amber-200 font-mono">mr_settlement_master</strong> (or <strong className="text-amber-200 font-mono">mill_inspection_master</strong>): Holds delivery penalty records.<br />
                • <strong className="text-amber-200 font-mono">Claim Columns</strong>: <code className="text-emerald-300">summary_delivery_claim</code> (Delivery Claim Rs), <code className="text-emerald-300">detention_days</code> (Late Delay Days), <code className="text-emerald-300">arrival_date, po_date</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= SEARCH & CONTROLS BAR ================= */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Keyword, PO No, MR No, Supplier, Broker, Area..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:border-[#D94B5A] focus:bg-white transition"
          />
        </div>

        {activeSubReport === 'outstanding_po' && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <span className="text-slate-500 pl-1 text-[11px]">Group By:</span>
              <button
                type="button"
                onClick={() => setPoGroupBy('broker')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  poGroupBy === 'broker' ? 'bg-[#D94B5A] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Broker Wise
              </button>
              <button
                type="button"
                onClick={() => setPoGroupBy('supplier')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  poGroupBy === 'supplier' ? 'bg-[#D94B5A] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Party (Supplier) Wise
              </button>
              <button
                type="button"
                onClick={() => setPoGroupBy('area')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  poGroupBy === 'area' ? 'bg-[#D94B5A] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Area Wise
              </button>
              <button
                type="button"
                onClick={() => setPoGroupBy('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  poGroupBy === 'all' ? 'bg-[#D94B5A] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All PO List
              </button>
            </div>

            <select
              value={poStatusFilter}
              onChange={(e) => setPoStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:border-[#D94B5A]"
            >
              <option value="ALL">All Status (Pending & Partial)</option>
              <option value="PENDING">Pending Only (0% Rcvd)</option>
              <option value="PARTIAL">Partial Only (&gt;0% Rcvd)</option>
            </select>
          </div>
        )}
      </div>

      {/* ================= REPORT CONTENT VIEWS ================= */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
          <RefreshCcw className="w-8 h-8 animate-spin text-[#D94B5A] mx-auto" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Loading Report Records...</p>
        </div>
      ) : (
        <>
          {/* 1. OUTSTANDING P.O LIST REPORT */}
          {activeSubReport === 'outstanding_po' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 rounded-2xl border border-slate-700 shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Outstanding POs</span>
                  <div className="text-xl font-black text-white">{filteredPoList.length} POs</div>
                  <span className="text-[10px] text-slate-300">Pending & Partial Deliveries</span>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-100">Total Contracted Qty</span>
                  <div className="text-xl font-black text-white">
                    {filteredPoList.reduce((a, c) => a + c.totalQty, 0).toFixed(2)} MT
                  </div>
                  <span className="text-[10px] text-amber-100">Contracted Volume</span>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-100">Total Received Qty</span>
                  <div className="text-xl font-black text-white">
                    {filteredPoList.reduce((a, c) => a + c.rcvdQty, 0).toFixed(2)} MT
                  </div>
                  <span className="text-[10px] text-emerald-100">Delivered Material</span>
                </div>

                <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-rose-100">Pending Balance Qty</span>
                  <div className="text-xl font-black text-white">
                    {filteredPoList.reduce((a, c) => a + c.pendingQty, 0).toFixed(2)} MT
                  </div>
                  <span className="text-[10px] text-rose-100">
                    Est. Value: ₹{filteredPoList.reduce((a, c) => a + c.pendingValue, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Outstanding PO Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#D94B5A]" />
                    <span>
                      OUTSTANDING P.O REPORT ({poGroupBy.toUpperCase()} WISE) — {groupedPoSummary.length} GROUPS
                    </span>
                  </h3>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md">
                    Showing Pending & Partial Deliveries
                  </span>
                </div>

                {poGroupBy === 'all' ? (
                  // Detailed PO List View
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                          <th className="p-2.5">PO No & Date</th>
                          <th className="p-2.5">Supplier / Party</th>
                          <th className="p-2.5">Broker</th>
                          <th className="p-2.5">Area / Agency</th>
                          <th className="p-2.5 text-right">Contract MT</th>
                          <th className="p-2.5 text-right">Rcvd MT</th>
                          <th className="p-2.5 text-right text-amber-300">Pending MT</th>
                          <th className="p-2.5 text-right">Est. Pending Val (₹)</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredPoList.map((po, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-bold font-mono text-[#D94B5A]">
                              <div>{po.poNo}</div>
                              <div className="text-[9.5px] font-normal text-slate-500">{po.poDate}</div>
                            </td>
                            <td className="p-2.5 font-bold">{po.supplier}</td>
                            <td className="p-2.5 text-slate-700">{po.broker}</td>
                            <td className="p-2.5 text-slate-600">{po.area} / {po.agency}</td>
                            <td className="p-2.5 text-right font-mono font-bold">{po.totalQty.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">{po.rcvdQty.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-rose-600">{po.pendingQty.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono font-bold">
                              ₹{po.pendingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase ${
                                po.status === 'PENDING'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Grouped Summary View (Broker Wise / Party Wise / Area Wise)
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                          <th className="p-2.5">{poGroupBy.toUpperCase()} NAME</th>
                          <th className="p-2.5 text-center">PO COUNT</th>
                          <th className="p-2.5 text-right">TOTAL CONTRACT (MT)</th>
                          <th className="p-2.5 text-right text-emerald-300">RECEIVED (MT)</th>
                          <th className="p-2.5 text-right text-amber-300">PENDING BALANCE (MT)</th>
                          <th className="p-2.5 text-right">EST. PENDING VALUE (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {groupedPoSummary.map((group, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-bold uppercase text-slate-900">{group.key}</td>
                            <td className="p-2.5 text-center font-mono font-bold">{group.totalPoCount}</td>
                            <td className="p-2.5 text-right font-mono font-bold">{group.totalQty.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{group.rcvdQty.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-rose-600">{group.pendingQty.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              ₹{group.pendingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-900 text-white font-bold text-[11px]">
                        <tr>
                          <td className="p-2.5 uppercase">GRAND TOTAL</td>
                          <td className="p-2.5 text-center font-mono">
                            {groupedPoSummary.reduce((a, c) => a + c.totalPoCount, 0)}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {groupedPoSummary.reduce((a, c) => a + c.totalQty, 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-300">
                            {groupedPoSummary.reduce((a, c) => a + c.rcvdQty, 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-300">
                            {groupedPoSummary.reduce((a, c) => a + c.pendingQty, 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-300">
                            ₹{groupedPoSummary.reduce((a, c) => a + c.pendingValue, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. MR ELIGIBLE FOR ADVANCE REPORT */}
          {activeSubReport === 'mr_advance_eligible' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-3.5 rounded-2xl border border-indigo-700 shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-300">Total MR Records</span>
                  <div className="text-xl font-black text-white">{filteredAdvanceMrList.length} MRs</div>
                  <span className="text-[10px] text-indigo-200">Goods Arrival Receipts</span>
                </div>

                <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-200">Total Est. Material Value</span>
                  <div className="text-xl font-black text-white">
                    ₹{filteredAdvanceMrList.reduce((a, c) => a + c.materialValue, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-emerald-200">Gross Material Value</span>
                </div>

                <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-100">Advance Paid To Date</span>
                  <div className="text-xl font-black text-white">
                    ₹{filteredAdvanceMrList.reduce((a, c) => a + c.paidAdvanceAmt, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-amber-100">Disbursed On A/c Advance</span>
                </div>

                <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-rose-100">Pending Advance Eligible</span>
                  <div className="text-xl font-black text-white">
                    ₹{filteredAdvanceMrList.reduce((a, c) => a + c.pendingAdvancePayable, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-rose-100">Eligible for Disbursal</span>
                </div>
              </div>

              {/* Table View */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#D94B5A]" />
                    <span>LIST OF MRs ELIGIBLE FOR ADVANCE DISBURSAL</span>
                  </h3>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    Target Eligibility: 90% of Material Value
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                        <th className="p-2.5">MR No & Date</th>
                        <th className="p-2.5">PO No</th>
                        <th className="p-2.5">Supplier / Party</th>
                        <th className="p-2.5">Broker</th>
                        <th className="p-2.5 text-right">Arrival Wt (MT)</th>
                        <th className="p-2.5 text-right">Est. Mat. Value (₹)</th>
                        <th className="p-2.5 text-right">Eligible Adv (90%) (₹)</th>
                        <th className="p-2.5 text-right">Paid Adv (₹)</th>
                        <th className="p-2.5 text-right text-amber-300">Pending Adv Payable (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredAdvanceMrList.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-bold font-mono text-[#D94B5A]">
                            <div>{row.mrNo}</div>
                            <div className="text-[9.5px] font-normal text-slate-500">{row.arrivalDate}</div>
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-700">{row.poNo}</td>
                          <td className="p-2.5 font-bold">{row.supplier}</td>
                          <td className="p-2.5 text-slate-600">{row.broker}</td>
                          <td className="p-2.5 text-right font-mono">{row.arrWtMt.toFixed(2)} MT</td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            ₹{row.materialValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                            ₹{row.eligibleAdvanceAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                            ₹{row.paidAdvanceAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                            ₹{row.pendingAdvancePayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. MR WISE APMC DETAILS REPORT */}
          {activeSubReport === 'mr_apmc_details' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 rounded-2xl border border-slate-700 shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Challan APMC Fees</span>
                  <div className="text-xl font-black text-amber-300">
                    ₹{filteredApmcList.reduce((a, c) => a + c.challanApmc, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-slate-300">Declared on Challan at Gate</span>
                </div>

                <div className="bg-gradient-to-br from-indigo-700 to-indigo-800 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-200">Total Actual APMC (1%)</span>
                  <div className="text-xl font-black text-white">
                    ₹{filteredApmcList.reduce((a, c) => a + c.actualApmc, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-indigo-200">Calculated 1% of Material Value</span>
                </div>

                <div className="bg-gradient-to-br from-rose-700 to-rose-800 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-rose-200">Total APMC Settlement Deduction</span>
                  <div className="text-xl font-black text-white">
                    ₹{filteredApmcList.reduce((a, c) => a + c.apmcDiff, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-rose-200">Net APMC Adjustment charged</span>
                </div>
              </div>

              {/* Table View */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#D94B5A]" />
                    <span>MR WISE APMC DETAILS REPORT</span>
                  </h3>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                    APMC Cess Ledger per MR
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                        <th className="p-2.5">MR No & Date</th>
                        <th className="p-2.5">PO No</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5">Broker</th>
                        <th className="p-2.5 text-right">Material Value (₹)</th>
                        <th className="p-2.5 text-right text-amber-300">Challan APMC (₹)</th>
                        <th className="p-2.5 text-right text-emerald-300">Actual APMC (1%) (₹)</th>
                        <th className="p-2.5 text-right text-rose-300">APMC Deduction Diff (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredApmcList.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-bold font-mono text-[#D94B5A]">
                            <div>{row.mrNo}</div>
                            <div className="text-[9.5px] font-normal text-slate-500">{row.settDate}</div>
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-700">{row.poNo}</td>
                          <td className="p-2.5 font-bold">{row.supplier}</td>
                          <td className="p-2.5 text-slate-600">{row.broker}</td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            ₹{row.materialValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-700">
                            ₹{row.challanApmc.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                            ₹{row.actualApmc.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                            ₹{row.apmcDiff.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. MR WISE DELIVERY CLAIM REPORT */}
          {activeSubReport === 'mr_delivery_claim' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 rounded-2xl border border-slate-700 shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total MRs Analyzed</span>
                  <div className="text-xl font-black text-white">{filteredDeliveryClaimList.length} MRs</div>
                  <span className="text-[10px] text-slate-300">Arrival Receipts</span>
                </div>

                <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-100">Total Detention / Delay Days</span>
                  <div className="text-xl font-black text-white">
                    {filteredDeliveryClaimList.reduce((a, c) => a + c.detentionDays, 0)} Days
                  </div>
                  <span className="text-[10px] text-amber-100">Delayed Arrival Periods</span>
                </div>

                <div className="bg-gradient-to-br from-rose-700 to-rose-800 text-white p-3.5 rounded-2xl shadow-md space-y-1">
                  <span className="text-[10px] uppercase font-bold text-rose-200">Total Delivery Claims</span>
                  <div className="text-xl font-black text-white">
                    ₹{filteredDeliveryClaimList.reduce((a, c) => a + c.claimAmt, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-rose-200">Late Delivery Penalty Charged</span>
                </div>
              </div>

              {/* Table View */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#D94B5A]" />
                    <span>MR WISE DELIVERY CLAIM REPORT</span>
                  </h3>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md">
                    Late Delivery Penalties & Claims
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                        <th className="p-2.5">MR No & Date</th>
                        <th className="p-2.5">PO No & Date</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5">Broker</th>
                        <th className="p-2.5 text-center">Delay / Detention Days</th>
                        <th className="p-2.5 text-right text-rose-300">Delivery Claim (₹)</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredDeliveryClaimList.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 font-bold font-mono text-[#D94B5A]">
                            <div>{row.mrNo}</div>
                            <div className="text-[9.5px] font-normal text-slate-500">{row.mrDate}</div>
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">
                            <div className="font-bold">{row.poNo}</div>
                            <div className="text-[9.5px] font-normal text-slate-500">{row.poDate || '-'}</div>
                          </td>
                          <td className="p-2.5 font-bold">{row.supplier}</td>
                          <td className="p-2.5 text-slate-600">{row.broker}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-amber-700">
                            {row.detentionDays} Days
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                            ₹{row.claimAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2.5 text-slate-600 text-[10.5px]">{row.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
