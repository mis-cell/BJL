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

import { ReportFilterCriteria } from '../../services/systemReportEngine';

export type NewReportTab = 'outstanding_po' | 'mr_advance_eligible' | 'mr_apmc_details' | 'mr_delivery_claim';

interface NewCustomReportsViewProps {
  initialTab?: NewReportTab;
  filters?: ReportFilterCriteria;
}

const parseDateObj = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str) return null;

  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const parts = str.split(/[-/]/);
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
    const parts = str.split(/[-/]/);
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const matchesFilters = (
  dateStr: string | undefined,
  supplier: string | undefined,
  broker: string | undefined,
  area: string | undefined,
  agency: string | undefined,
  poNo: string | undefined,
  mrNo: string | undefined,
  filters?: ReportFilterCriteria,
  localQuery?: string
): boolean => {
  // 1. Text Search
  const q = (localQuery || filters?.searchQuery || '').trim().toLowerCase();
  if (q) {
    const combined = [poNo, mrNo, supplier, broker, area, agency].filter(Boolean).join(' ').toLowerCase();
    if (!combined.includes(q)) return false;
  }

  if (!filters) return true;

  // 2. Filter dropdowns
  if (filters.supplier && supplier && !supplier.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
  if (filters.broker && broker && !broker.toLowerCase().includes(filters.broker.toLowerCase())) return false;
  if (filters.area && area && !area.toLowerCase().includes(filters.area.toLowerCase())) return false;
  if (filters.agency && agency && !agency.toLowerCase().includes(filters.agency.toLowerCase())) return false;
  if (filters.po && poNo && !poNo.toLowerCase().includes(filters.po.toLowerCase())) return false;

  // 3. Date / Month / Financial Year
  if (!dateStr) return true;
  const recordDate = parseDateObj(dateStr);
  if (!recordDate) return true;

  // Month Filter (e.g. "2026-08" or "08" or "8")
  if (filters.month) {
    const fMonth = filters.month.trim();
    const yr = recordDate.getFullYear();
    const mo = String(recordDate.getMonth() + 1).padStart(2, '0');
    const yyyyMm = `${yr}-${mo}`;
    if (fMonth.includes('-')) {
      if (yyyyMm !== fMonth) return false;
    } else {
      if (mo !== fMonth.padStart(2, '0')) return false;
    }
  }

  // Financial Year Filter
  if (filters.financialYear) {
    const fyStr = filters.financialYear.trim();
    const month = recordDate.getMonth() + 1;
    const year = recordDate.getFullYear();
    const startFy = month >= 4 ? year : year - 1;
    if (!fyStr.includes(String(startFy))) return false;
  }

  // Date From Filter
  if (filters.dateFrom) {
    const fromDate = parseDateObj(filters.dateFrom);
    if (fromDate) {
      fromDate.setHours(0, 0, 0, 0);
      const d = new Date(recordDate);
      d.setHours(0, 0, 0, 0);
      if (d < fromDate) return false;
    }
  }

  // Date To Filter
  if (filters.dateTo) {
    const toDate = parseDateObj(filters.dateTo);
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
      if (recordDate > toDate) return false;
    }
  }

  return true;
};

export const NewCustomReportsView: React.FC<NewCustomReportsViewProps> = ({ initialTab = 'mr_delivery_claim', filters }) => {
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
        // Fetch POs, Sauda Check Points, Temporary Arrivals, Final Arrivals, Inspections, Settlements & Payments
        const [poRes, faRes, mrSettRes, payMasterRes, saudaCpRes, tempArrRes, matInspRes] = await Promise.all([
          supabase.from('purchase_master').select('*').order('created_at', { ascending: false }),
          supabase.from('final_arrival').select('*').order('date', { ascending: false }),
          supabase.from('mr_settlement_master').select('*').order('created_at', { ascending: false }),
          supabase.from('payment_master').select('*').order('created_at', { ascending: false }),
          supabase.from('sauda_check_point').select('*').order('created_at', { ascending: false }),
          supabase.from('temporary_material_received').select('*').order('date', { ascending: false }),
          supabase.from('material_inspection').select('*').order('created_at', { ascending: false })
        ]);

        const rawPos = poRes.data || [];
        const rawFa = faRes.data || [];
        const rawSettlements = mrSettRes.data || [];
        const rawPayments = payMasterRes.data || [];
        const rawCheckpoints = saudaCpRes.data || [];
        const rawTempArrivals = tempArrRes.data || [];
        const rawMatInsp = matInspRes.data || [];

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

        // =========================================================================
        // 4. Process MR Wise Delivery Claim (Sauda Check Point -> Temporary Arrival)
        // =========================================================================
        const cleanPoKey = (s: any) => String(s || '').trim().replace(/^#/, '').toUpperCase();
        const cleanLorryKey = (s: any) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const extractCoreDigits = (s: any) => {
          const raw = String(s || '').trim().toUpperCase();
          const withoutPrefix = raw.replace(/^(MR|AR|AMAD|TEMP|FA|BJCL)[-\/\s]*/i, '').replace(/^20\d{2}-20\d{2}\//, '');
          return withoutPrefix.replace(/[^0-9]/g, '').replace(/^0+/, '');
        };

        // Step A: Build Sauda Check Point (and Purchase Master) lookup for Delivery Due Date & Delivery Penalty Rate
        const poDeliveryMap = new Map<string, {
          poNo: string;
          poDate: string;
          deliveryFrom: string;
          deliveryTo: string;
          graceDays: number;
          deliveryPenaltyRate: number;
          supplier: string;
          broker: string;
        }>();

        rawPos.forEach((po: any) => {
          const key = cleanPoKey(po.po_no || po.po_number);
          if (!key) return;
          poDeliveryMap.set(key, {
            poNo: String(po.po_no || po.po_number || key).trim(),
            poDate: String(po.po_date || po.date || po.s_date || '').split('T')[0],
            deliveryFrom: String(po.delivery_from || po.delivery_gt_from || '').split('T')[0],
            deliveryTo: String(po.delivery_to || po.delivery_gt_to || po.shipment_date || po.delivery_to_date || '').split('T')[0],
            graceDays: Number(po.grace_days || 0),
            deliveryPenaltyRate: Number(po.delivery_penalty || po.shipment_penalty || 0),
            supplier: String(po.supplier || po.supplier_name || '').toUpperCase().trim(),
            broker: String(po.broker || po.broker_name || '').toUpperCase().trim()
          });
        });

        rawCheckpoints.forEach((cp: any) => {
          const keys = [cp.po_no, cp.ptf_no, cp.sauda_no, cp.contract_po_no].map(cleanPoKey).filter(Boolean);
          if (keys.length === 0) return;
          const primaryKey = keys[0];
          const existing = poDeliveryMap.get(primaryKey);

          const entry = {
            poNo: String(cp.po_no || existing?.poNo || primaryKey).trim(),
            poDate: String(cp.po_date || cp.date || cp.s_date || existing?.poDate || '').split('T')[0],
            deliveryFrom: String(cp.delivery_from || cp.delivery_gt_from || existing?.deliveryFrom || '').split('T')[0],
            deliveryTo: String(cp.delivery_to || cp.delivery_gt_to || cp.shipment_date || cp.delivery_to_date || existing?.deliveryTo || '').split('T')[0],
            graceDays: Number(cp.grace_days ?? existing?.graceDays ?? 0),
            deliveryPenaltyRate: Number(cp.delivery_penalty || cp.shipment_penalty || existing?.deliveryPenaltyRate || 0),
            supplier: String(cp.supplier || cp.supplier_name || existing?.supplier || '').toUpperCase().trim(),
            broker: String(cp.broker || cp.broker_name || existing?.broker || '').toUpperCase().trim()
          };

          keys.forEach(k => poDeliveryMap.set(k, entry));
        });

        // Step B: Helper to calculate Delay Days (Temporary Arrival Date - Sauda Check Point Delivery To Date)
        const calcDelayDays = (deliveryToStr?: string, arrivalDateStr?: string): number => {
          if (!deliveryToStr || !arrivalDateStr) return 0;
          const due = parseDateObj(deliveryToStr);
          const arr = parseDateObj(arrivalDateStr);
          if (!due || !arr) return 0;
          due.setHours(0, 0, 0, 0);
          arr.setHours(0, 0, 0, 0);
          const diffMs = arr.getTime() - due.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          return diffDays > 0 ? diffDays : 0;
        };

        // Step C: Helper to extract Arrival Weight in Quintals (Qtl)
        const getArrivalWeightQtl = (...records: any[]): number => {
          for (const rec of records) {
            if (!rec) continue;
            const qtl = Number(rec.weight_qtl || 0);
            if (qtl > 0) return Number(qtl.toFixed(2));
            const rawWt = Number(
              rec.electronic_net_weight ||
              rec.supplier_net_weight ||
              rec.challan_material_weight ||
              rec.electronic_scale_net ||
              rec.challan_weight ||
              rec.supplier_net_wt ||
              ((Number(rec.actual_gross_weight) || 0) - (Number(rec.actual_tare_weight) || 0)) ||
              0
            );
            if (rawWt > 0) {
              if (rawWt > 500) return Number((rawWt / 100).toFixed(2));
              if (rawWt <= 50) return Number((rawWt * 10).toFixed(2));
              return Number(rawWt.toFixed(2));
            }
          }
          return 0;
        };

        // Step D: Build cross-reference maps between Temporary Arrival, Final Arrival, Mill Inspection, and Settlement
        const deliveryClaimRecords: any[] = [];
        const seenDeliveryKeys = new Set<string>();

        const registerDeliveryClaimCandidate = (params: {
          tmr?: any;
          fa?: any;
          mi?: any;
          sett?: any;
        }) => {
          const { tmr, fa, mi, sett } = params;
          const isMrSeries = (v: any) => Boolean(v && String(v).trim().toUpperCase().startsWith('MR'));

          const rawMrCandidates = [mi?.mr_no, sett?.mr_no, fa?.mr_no, tmr?.mr_no];
          const mrSeriesMatch = rawMrCandidates.find(isMrSeries);
          const tempArrivalNo = String(
            tmr?.temporary_arrival_no ||
            tmr?.amad_no ||
            tmr?.arrival_no ||
            fa?.temporary_arrival_no ||
            fa?.arrival_no ||
            fa?.final_arrival_no ||
            mi?.arrival_no ||
            sett?.arrival_no ||
            ''
          ).trim();

          let resolvedMrNo = String(mrSeriesMatch || mi?.mr_no || sett?.mr_no || fa?.mr_no || tempArrivalNo || '').trim();
          if (!resolvedMrNo) return;

          // If resolvedMrNo is AR00893, check if an MR00893 exists in inspections/settlements
          const coreDigits = extractCoreDigits(resolvedMrNo);
          if (!isMrSeries(resolvedMrNo) && coreDigits) {
            const matchedInsp = rawMatInsp.find((m: any) => isMrSeries(m.mr_no) && extractCoreDigits(m.mr_no) === coreDigits);
            const matchedSett = rawSettlements.find((s: any) => isMrSeries(s.mr_no) && extractCoreDigits(s.mr_no) === coreDigits);
            if (matchedInsp?.mr_no) resolvedMrNo = matchedInsp.mr_no;
            else if (matchedSett?.mr_no) resolvedMrNo = matchedSett.mr_no;
          }

          const dedupKey = coreDigits ? `CORE_${coreDigits}` : resolvedMrNo.toUpperCase();
          if (seenDeliveryKeys.has(dedupKey)) return;

          const rawPoNo = String(
            tmr?.po_no ||
            fa?.po_no ||
            mi?.po_no ||
            sett?.po_no ||
            ''
          ).trim();
          const poKey = cleanPoKey(rawPoNo);
          const poInfo = poKey ? poDeliveryMap.get(poKey) : undefined;

          // Temporary Arrival Date is the primary arrival date for Delivery Claim calculation
          const tempArrivalDate = String(
            tmr?.date ||
            tmr?.arrival_date ||
            fa?.date ||
            fa?.arrival_date ||
            mi?.arrival_date ||
            sett?.arrival_date ||
            sett?.mr_date ||
            ''
          ).split('T')[0];

          const deliveryToDate = String(
            poInfo?.deliveryTo ||
            fa?.delivery_to ||
            mi?.delivery_to ||
            ''
          ).split('T')[0];

          const poDate = String(
            poInfo?.poDate ||
            fa?.po_date ||
            mi?.po_date ||
            sett?.po_date ||
            ''
          ).split('T')[0];

          const penaltyRate = Number(poInfo?.deliveryPenaltyRate || 0);
          const weightQtl = getArrivalWeightQtl(tmr, fa, mi, sett);

          // Calculate Delay Days from Sauda Check Point (delivery_to) to Temporary Arrival (date)
          let detentionDays = calcDelayDays(deliveryToDate, tempArrivalDate);
          if (detentionDays === 0 && !deliveryToDate) {
            detentionDays = Number(sett?.detention_days || fa?.detention_days || mi?.detention_days || 0);
          }

          // Calculate Delivery Claim (₹) = Weight (Qtl) * Delay Days * Delivery Penalty Rate
          const calculatedClaimAmt = (detentionDays > 0 && penaltyRate > 0 && weightQtl > 0)
            ? Math.round(weightQtl * penaltyRate * detentionDays)
            : 0;

          const explicitSavedClaim = (
            sett?.summary_delivery_claim &&
            Number(sett.summary_delivery_claim) > 0 &&
            Number(sett.summary_delivery_claim) !== 5550
          ) ? Number(sett.summary_delivery_claim) : 0;

          // Only assign a delivery claim when there is a valid late arrival delay from Sauda Check Point to Temporary Arrival
          const claimAmt = calculatedClaimAmt > 0
            ? calculatedClaimAmt
            : (detentionDays > 0 ? explicitSavedClaim : 0);

          if (claimAmt > 0 && detentionDays > 0) {
            seenDeliveryKeys.add(dedupKey);
            const supplierName = String(
              poInfo?.supplier ||
              tmr?.supplier ||
              tmr?.challan_supplier ||
              fa?.supplier ||
              mi?.supplier_name ||
              sett?.supplier ||
              'UNKNOWN'
            ).toUpperCase().trim();

            const brokerName = String(
              poInfo?.broker ||
              tmr?.broker ||
              fa?.broker ||
              mi?.broker_name ||
              sett?.broker ||
              'DIRECT'
            ).toUpperCase().trim();

            const calcBreakdown = (weightQtl > 0 && penaltyRate > 0)
              ? `Due: ${deliveryToDate || '-'} → Temp Arr: ${tempArrivalDate || '-'} (${weightQtl} Qtl × ${detentionDays}d × ₹${penaltyRate})`
              : `Due: ${deliveryToDate || '-'} → Temp Arr: ${tempArrivalDate || '-'}`;

            deliveryClaimRecords.push({
              mrNo: resolvedMrNo,
              tempArrivalNo: tempArrivalNo || resolvedMrNo,
              mrDate: tempArrivalDate,
              poNo: poInfo?.poNo || rawPoNo || '-',
              poDate: poDate,
              deliveryToDate: deliveryToDate,
              arrivalDate: tempArrivalDate,
              supplier: supplierName,
              broker: brokerName,
              weightQtl,
              penaltyRate,
              detentionDays,
              claimAmt,
              remarks: calcBreakdown
            });
          }
        };

        // 1. Primary Pass: Iterate Temporary Arrivals (Sauda Check Point -> Temporary Arrival)
        rawTempArrivals.forEach((tmr: any) => {
          const tempNo = String(tmr.temporary_arrival_no || tmr.amad_no || tmr.arrival_no || '').trim();
          const tmrDigits = extractCoreDigits(tempNo || tmr.mr_no);
          const tmrPo = cleanPoKey(tmr.po_no);
          const tmrLorry = cleanLorryKey(tmr.lorry_number || tmr.lorry_no || tmr.vehicle_no);

          const matchedFa = rawFa.find((f: any) => {
            const fTemp = String(f.temporary_arrival_no || f.arrival_no || f.final_arrival_no || '').trim();
            if (tempNo && fTemp.toUpperCase() === tempNo.toUpperCase()) return true;
            if (tmrDigits && extractCoreDigits(f.mr_no || fTemp) === tmrDigits) return true;
            if (tmrPo && tmrLorry.length >= 4 && cleanPoKey(f.po_no) === tmrPo && cleanLorryKey(f.lorry_number || f.lorry_no) === tmrLorry) return true;
            return false;
          });

          const matchedMi = rawMatInsp.find((m: any) => {
            const mArr = String(m.arrival_no || m.ref_arrival_no || '').trim();
            if (tempNo && mArr.toUpperCase() === tempNo.toUpperCase()) return true;
            if (tmrDigits && extractCoreDigits(m.mr_no || mArr) === tmrDigits) return true;
            if (tmrPo && tmrLorry.length >= 4 && cleanPoKey(m.po_no) === tmrPo && cleanLorryKey(m.lorry_number || m.lorry_no) === tmrLorry) return true;
            return false;
          });

          const matchedSett = rawSettlements.find((s: any) => {
            const sArr = String(s.arrival_no || '').trim();
            if (tempNo && sArr.toUpperCase() === tempNo.toUpperCase()) return true;
            if (tmrDigits && extractCoreDigits(s.mr_no || sArr) === tmrDigits) return true;
            if (tmrPo && tmrLorry.length >= 4 && cleanPoKey(s.po_no) === tmrPo && cleanLorryKey(s.lorry_number) === tmrLorry) return true;
            return false;
          });

          registerDeliveryClaimCandidate({ tmr, fa: matchedFa, mi: matchedMi, sett: matchedSett });
        });

        // 2. Secondary Pass: Check Final Arrivals & Settlements not yet processed in Temporary Arrival pass
        rawFa.forEach((fa: any) => {
          const faDigits = extractCoreDigits(fa.mr_no || fa.final_arrival_no || fa.arrival_no);
          const matchedMi = rawMatInsp.find((m: any) => faDigits && extractCoreDigits(m.mr_no || m.arrival_no) === faDigits);
          const matchedSett = rawSettlements.find((s: any) => faDigits && extractCoreDigits(s.mr_no || s.arrival_no) === faDigits);
          registerDeliveryClaimCandidate({ fa, mi: matchedMi, sett: matchedSett });
        });

        rawSettlements.forEach((sett: any) => {
          registerDeliveryClaimCandidate({ sett });
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
      return matchesFilters(po.poDate, po.supplier, po.broker, po.area, po.agency, po.poNo, undefined, filters, searchQuery);
    });
  }, [poList, poStatusFilter, searchQuery, filters]);

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
      return matchesFilters(item.arrivalDate, item.supplier, item.broker, undefined, undefined, item.poNo, item.mrNo, filters, searchQuery);
    });
  }, [advanceMrList, searchQuery, filters]);

  // Filter APMC Details List
  const filteredApmcList = useMemo(() => {
    return apmcList.filter(item => {
      return matchesFilters(item.settDate, item.supplier, item.broker, undefined, undefined, item.poNo, item.mrNo, filters, searchQuery);
    });
  }, [apmcList, searchQuery, filters]);

  // Filter Delivery Claim List (Only show records with claimAmt > 0 and detentionDays > 0)
  const filteredDeliveryClaimList = useMemo(() => {
    return deliveryClaimList.filter(item => {
      if (!(item.claimAmt > 0 && item.detentionDays > 0)) return false;
      return matchesFilters(item.arrivalDate || item.mrDate || item.poDate, item.supplier, item.broker, undefined, undefined, item.poNo, item.mrNo, filters, searchQuery);
    });
  }, [deliveryClaimList, searchQuery, filters]);

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
      const headers = ['MR No', 'Temp Arrival Date', 'PO No', 'PO Date', 'Delivery Due Date', 'Supplier', 'Broker', 'Weight (Qtl)', 'Penalty Rate (Rs/Qtl/Day)', 'Detention/Delay Days', 'Delivery Claim Amount (Rs)', 'Remarks'];
      const rows = filteredDeliveryClaimList.map(r => [r.mrNo, r.arrivalDate, r.poNo, r.poDate, r.deliveryToDate || '-', r.supplier, r.broker, (r.weightQtl || 0).toFixed(2), r.penaltyRate || 0, r.detentionDays, r.claimAmt.toFixed(2), r.remarks]);
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
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

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
                    <span>MR WISE DELIVERY CLAIM REPORT (SAUDA CHECK POINT TO TEMPORARY ARRIVAL)</span>
                  </h3>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md">
                    Late Delivery Penalties & Claims
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                        <th className="p-2.5">MR No & Temp Arrival Date</th>
                        <th className="p-2.5">PO No & PO Date</th>
                        <th className="p-2.5">Delivery Due Date</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5">Broker</th>
                        <th className="p-2.5 text-center">Delay / Detention Days</th>
                        <th className="p-2.5 text-right text-rose-300">Delivery Claim (₹)</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredDeliveryClaimList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">
                            No Delayed Delivery Claims (&gt; ₹0) found for the selected filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredDeliveryClaimList.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-bold font-mono text-[#D94B5A]">
                              <div>{row.mrNo}</div>
                              <div className="text-[9.5px] font-normal text-slate-500">Temp Arr: {row.arrivalDate || row.mrDate}</div>
                            </td>
                            <td className="p-2.5 font-mono text-slate-700">
                              <div className="font-bold">{row.poNo}</div>
                              <div className="text-[9.5px] font-normal text-slate-500">{row.poDate || '-'}</div>
                            </td>
                            <td className="p-2.5 font-mono font-bold text-slate-700">
                              <div>{row.deliveryToDate || '-'}</div>
                              {row.penaltyRate ? (
                                <div className="text-[9.5px] font-normal text-slate-500">Penalty: ₹{row.penaltyRate}/Qtl/Day</div>
                              ) : null}
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
                        ))
                      )}
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
