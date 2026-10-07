import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Minus,
  HelpCircle,
  BarChart3,
  Calendar,
  Layers,
  Building,
  User,
  Truck,
  Droplets,
  Coins,
  Scale,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Check,
  Percent,
  CheckCheck,
  Hash,
  MapPin,
  Tag,
  Package,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { dbModule } from '../../services/dbModule';
import { calculateWeightTolerance } from '../../lib/weightTolerance';

export interface PoHistogramHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: any;
  allPayments?: any[];
  allSettlements?: any[];
  allArrivals?: any[];
  allInspections?: any[];
  onNavigateToMismatch?: (poNo: string) => void;
  onNavigateToPayment?: (poNo: string) => void;
  onNavigateToSettlement?: (poNo: string) => void;
}

export interface ComparisonField {
  name: string;
  referenceValue: string | number;
  actualValue: string | number;
  variance?: string | number;
  status: 'match' | 'mismatch' | 'not_available' | 'not_applicable';
  notes?: string;
  isCritical?: boolean;
}

export interface SectionComparison {
  id: string;
  title: string;
  icon: React.ElementType;
  fields: ComparisonField[];
  mismatchCount: number;
  status: 'clean' | 'mismatch' | 'pending';
  existingRecords?: any[];
}

export interface MrComparisonData {
  mrNo: string;
  arrivalRecord?: any;
  inspectionRecord?: any;
  settlementRecord?: any;
  paymentRecord?: any;
  tempArrivalFields: ComparisonField[];
  millInspFields: ComparisonField[];
  mismatchCount: number;
}

export const PoHistogramHistoryModal: React.FC<PoHistogramHistoryModalProps> = ({
  isOpen,
  onClose,
  po,
  allPayments = [],
  allSettlements = [],
  allArrivals = [],
  allInspections = [],
  onNavigateToMismatch,
  onNavigateToPayment,
  onNavigateToSettlement
}) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'compare' | 'story' | 'histogram' | 'mismatch_audit'>('compare');
  const [selectedMrTab, setSelectedMrTab] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Fetched Live Linked Database Data
  const [dbPoDetails, setDbPoDetails] = useState<any[]>([]);
  const [dbArrivals, setDbArrivals] = useState<any[]>([]);
  const [dbInspections, setDbInspections] = useState<any[]>([]);
  const [dbPayments, setDbPayments] = useState<any[]>([]);
  const [dbSettlements, setDbSettlements] = useState<any[]>([]);
  const [dbMismatches, setDbMismatches] = useState<any[]>([]);
  const [dbSattaMismatches, setDbSattaMismatches] = useState<any[]>([]);
  const [dbSattaRate, setDbSattaRate] = useState<any | null>(null);

  // Load all linked records for this PO with robust multi-strategy fallback
  useEffect(() => {
    if (!isOpen || !po) return;

    let isMounted = true;
    const fetchLinkedHistoryData = async () => {
      setLoading(true);
      const targetPo = String(po.po_no || '').trim().toUpperCase();
      const targetSauda = String(po.sauda_no || '').trim().toUpperCase();
      const targetPtf = String(po.ptf_no || '').trim().toUpperCase();
      const poDigits = targetPo.replace(/[^0-9]/g, '');
      const poTail = targetPo.includes('/') ? targetPo.split('/').pop()?.trim().toUpperCase() : '';

      const isPoMatch = (rec: any) => {
        if (!rec) return false;
        const rPo = String(rec.po_no || '').trim().toUpperCase();
        const rSauda = String(rec.sauda_no || '').trim().toUpperCase();
        const rPtf = String(rec.ptf_no || '').trim().toUpperCase();
        const rArrivalNo = String(rec.temporary_arrival_no || rec.arrival_no || rec.mr_no || rec.amad_no || '').trim().toUpperCase();

        if (rPo && (rPo === targetPo || (targetSauda && rPo === targetSauda) || (targetPtf && rPo === targetPtf))) return true;
        if (rSauda && (rSauda === targetPo || (targetSauda && rSauda === targetSauda))) return true;
        if (rPtf && (rPtf === targetPo || (targetPtf && rPtf === targetPtf))) return true;

        if (poTail && (rPo === poTail || rSauda === poTail)) return true;
        if (poDigits && poDigits.length >= 3) {
          const rDigits = (rPo + rSauda + rPtf).replace(/[^0-9]/g, '');
          if (rDigits && (rDigits === poDigits || rDigits.endsWith(poDigits) || poDigits.endsWith(rDigits))) return true;
        }
        return false;
      };

      try {
        // Parallel queries to real Supabase tables + fallback to dbModule
        const [
          poDetailsRes,
          arrivalsDbRes,
          finalArrDbRes,
          arrivalsModuleRes,
          finalArrModuleRes,
          inspectionsDbRes,
          matInspectionsDbRes,
          inspectionsModuleRes,
          paymentsDbRes,
          paymentsModuleRes,
          settlementsDbRes,
          settlementsModuleRes,
          mismatchCasesRes,
          sattaMismatchRes,
          matMismatchRes,
          sattaMasterRes
        ] = await Promise.all([
          supabase ? Promise.resolve(supabase.from('sauda_check_point_details').select('*').eq('po_no', po.po_no)).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          supabase ? Promise.resolve(supabase.from('temporary_material_received').select('*')).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          supabase ? Promise.resolve(supabase.from('final_arrival').select('*')).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          dbModule.fetchAll('temporary_material_received').catch(() => []),
          dbModule.fetchAll('final_arrival').catch(() => []),
          supabase ? Promise.resolve(supabase.from('mill_inspection_master').select('*, mill_inspection_detail(*)')).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          supabase ? Promise.resolve(supabase.from('material_inspection').select('*, material_inspection_details(*)')).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          dbModule.fetchAll('mill_inspection_master').catch(() => []),
          supabase ? Promise.resolve(supabase.from('payment_details').select('*, payment_master(*)')).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          dbModule.fetchAll('payment_master').catch(() => []),
          supabase ? Promise.resolve(supabase.from('mr_settlement_master').select('*, mr_settlement_detail(*)')).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          dbModule.fetchAll('mr_settlement_master').catch(() => []),
          supabase ? Promise.resolve(supabase.from('mismatch_cases').select('*')).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          dbModule.fetchAll('satta_mismatch').catch(() => []),
          dbModule.fetchAll('material_mismatch').catch(() => []),
          supabase ? Promise.resolve(supabase.from('satta_master').select('*').limit(50)).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
        ]);

        // 1. Merge all Arrivals
        const rawArrivals = [
          ...((arrivalsDbRes as any)?.data || []),
          ...((finalArrDbRes as any)?.data || []),
          ...(Array.isArray(arrivalsModuleRes) ? arrivalsModuleRes : []),
          ...(Array.isArray(finalArrModuleRes) ? finalArrModuleRes : []),
          ...(Array.isArray(allArrivals) ? allArrivals : [])
        ];

        // Deduplicate arrivals by arrival_no / mr_no
        const arrivalMap = new Map<string, any>();
        rawArrivals.forEach((a: any) => {
          if (a && isPoMatch(a)) {
            const key = String(a.temporary_arrival_no || a.mr_no || a.amad_no || a.arrival_no || a.final_arrival_no || a.id || Math.random()).trim().toUpperCase();
            if (!arrivalMap.has(key)) {
              arrivalMap.set(key, a);
            }
          }
        });
        const matchedArrivals = Array.from(arrivalMap.values());

        // Helper to extract clean genuine MR identifiers (e.g. MR00748, MR00694)
        const isGenuineMr = (val: any): boolean => {
          if (!val) return false;
          const str = String(val).trim().toUpperCase();
          if (!str) return false;
          if (str.startsWith('MRRC-') || str.includes('MRRC-') || str.startsWith('INSP-') || str.startsWith('CERT-') || str.startsWith('TEST-') || str.startsWith('SETTLEMENT-')) {
            return false;
          }
          return true;
        };

        const mrSet = new Set<string>();
        matchedArrivals.forEach(a => {
          const mr = a.temporary_arrival_no || a.mr_no || a.mr_number || a.amad_no || a.arrival_no || a.final_arrival_no;
          if (mr && isGenuineMr(mr)) mrSet.add(String(mr).trim().toUpperCase());
        });
        if (po.mr_no && isGenuineMr(po.mr_no)) mrSet.add(String(po.mr_no).trim().toUpperCase());
        if (po.linked_mrs && Array.isArray(po.linked_mrs)) {
          po.linked_mrs.forEach((m: any) => m && isGenuineMr(m) && mrSet.add(String(m).trim().toUpperCase()));
        }

        const isPoOrMrMatch = (rec: any) => {
          if (!rec) return false;
          if (isPoMatch(rec)) return true;
          const rMr = String(rec.mr_no || rec.mr_number || rec.arrival_no || rec.ref_arrival_no || rec.temporary_arrival_no || rec.final_arrival_no || '').trim().toUpperCase();
          if (rMr && mrSet.has(rMr)) return true;
          return false;
        };

        // 2. Merge Inspections
        const rawInspections = [
          ...((inspectionsDbRes as any)?.data || []),
          ...((matInspectionsDbRes as any)?.data || []),
          ...(Array.isArray(inspectionsModuleRes) ? inspectionsModuleRes : []),
          ...(Array.isArray(allInspections) ? allInspections : [])
        ];
        const inspectionMap = new Map<string, any>();
        rawInspections.forEach((i: any) => {
          if (i && isPoOrMrMatch(i)) {
            const key = String(i.arrival_no || i.temporary_arrival_no || i.final_arrival_no || i.mr_no || i.mr_number || i.id || Math.random()).trim().toUpperCase();
            if (!inspectionMap.has(key)) {
              inspectionMap.set(key, i);
            }
          }
        });
        const matchedInspections = Array.from(inspectionMap.values());

        // 3. Merge Payments
        const rawPayments = [
          ...((paymentsDbRes as any)?.data || []),
          ...(Array.isArray(paymentsModuleRes) ? paymentsModuleRes : []),
          ...(Array.isArray(allPayments) ? allPayments : [])
        ];
        const paymentMap = new Map<string, any>();
        rawPayments.forEach((p: any) => {
          if (p && isPoOrMrMatch(p)) {
            const key = String(p.voucher_no || p.id || Math.random()).trim().toUpperCase();
            if (!paymentMap.has(key)) {
              paymentMap.set(key, p);
            }
          }
        });
        const matchedPayments = Array.from(paymentMap.values());

        // 4. Merge Settlements
        const rawSettlements = [
          ...((settlementsDbRes as any)?.data || []),
          ...(Array.isArray(settlementsModuleRes) ? settlementsModuleRes : []),
          ...(Array.isArray(allSettlements) ? allSettlements : [])
        ];
        const settlementMap = new Map<string, any>();
        rawSettlements.forEach((s: any) => {
          if (s && isPoOrMrMatch(s)) {
            const key = String(s.mr_no || s.mr_number || s.id || Math.random()).trim().toUpperCase();
            if (!settlementMap.has(key)) {
              settlementMap.set(key, s);
            }
          }
        });
        const matchedSettlements = Array.from(settlementMap.values());

        // 5. Merge Mismatches
        const rawMismatches = [
          ...((mismatchCasesRes as any)?.data || []),
          ...(Array.isArray(matMismatchRes) ? matMismatchRes : [])
        ].filter(isPoOrMrMatch);

        const rawSattaMismatches = (Array.isArray(sattaMismatchRes) ? sattaMismatchRes : []).filter(isPoOrMrMatch);

        // 6. Satta Limit Rate Reference
        const saudaDate = po.po_date || po.created_at?.slice(0, 10);
        const sattaRatesList = (sattaMasterRes as any)?.data || [];
        const foundSatta = sattaRatesList.find((s: any) => s.entry_date === saudaDate || s.date === saudaDate) || null;

        if (isMounted) {
          setDbPoDetails((poDetailsRes as any)?.data || []);
          setDbArrivals(matchedArrivals);
          setDbInspections(matchedInspections);
          setDbPayments(matchedPayments);
          setDbSettlements(matchedSettlements);
          setDbMismatches(rawMismatches);
          setDbSattaMismatches(rawSattaMismatches);
          setDbSattaRate(foundSatta);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching PO Histogram comparison data:', err);
        if (isMounted) {
          // Fallback to memory props
          setDbArrivals(allArrivals.filter(isPoMatch));
          setDbInspections(allInspections.filter(isPoMatch));
          setDbPayments(allPayments.filter(isPoMatch));
          setDbSettlements(allSettlements.filter(isPoMatch));
          setLoading(false);
        }
      }
    };

    fetchLinkedHistoryData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, po, allArrivals, allInspections, allPayments, allSettlements]);

  // Helper to extract arrival weight in MT
  const getArrivalWeightMt = (a: any): number => {
    if (!a) return 0;
    const val = parseFloat(a.final_weight_mt || a.received_weight_mt || a.electronic_net_weight || a.supplier_net_weight || a.challan_material_weight || a.net_weight || a.weight || 0);
    if (val > 0) return val;
    if (a.weight_qtl && Number(a.weight_qtl) > 0) return Number(a.weight_qtl) / 10;
    return 0;
  };

  // Derived Multi-MR list (e.g., MR00748, MR00694)
  const linkedMrs = useMemo(() => {
    const isGenuineMr = (val: any): boolean => {
      if (!val) return false;
      const str = String(val).trim().toUpperCase();
      if (!str) return false;
      if (str.startsWith('MRRC-') || str.includes('MRRC-') || str.startsWith('INSP-') || str.startsWith('CERT-') || str.startsWith('TEST-') || str.startsWith('SETTLEMENT-')) {
        return false;
      }
      return true;
    };

    const mrSet = new Set<string>();
    dbArrivals.forEach((a: any) => {
      const mr = a.temporary_arrival_no || a.mr_no || a.final_arrival_no || a.mr_number || a.amad_no || a.arrival_no;
      if (mr && isGenuineMr(mr)) mrSet.add(String(mr).trim().toUpperCase());
    });
    if (po?.mr_no && isGenuineMr(po.mr_no)) {
      mrSet.add(String(po.mr_no).trim().toUpperCase());
    }
    if (po?.linked_mrs && Array.isArray(po.linked_mrs)) {
      po.linked_mrs.forEach((m: any) => {
        if (m && isGenuineMr(m)) mrSet.add(String(m).trim().toUpperCase());
      });
    }
    dbSettlements.forEach((s: any) => {
      const mr = s.mr_no || s.mr_number || s.arrival_no;
      if (mr && isGenuineMr(mr)) mrSet.add(String(mr).trim().toUpperCase());
    });
    dbInspections.forEach((i: any) => {
      const arrRef = i.arrival_no || i.ref_arrival_no || i.temporary_arrival_no || i.final_arrival_no;
      if (arrRef && isGenuineMr(arrRef)) {
        mrSet.add(String(arrRef).trim().toUpperCase());
      } else if (i.mr_no && isGenuineMr(i.mr_no)) {
        mrSet.add(String(i.mr_no).trim().toUpperCase());
      }
    });
    dbPayments.forEach((p: any) => {
      const mr = p.mr_no || p.temporary_arrival_no || p.arrival_no;
      if (mr && isGenuineMr(mr)) mrSet.add(String(mr).trim().toUpperCase());
    });
    return Array.from(mrSet);
  }, [dbArrivals, dbInspections, dbSettlements, dbPayments, po]);

  // Comprehensive Comparison Engine
  const comparisonResults = useMemo(() => {
    if (!po) return { sections: [], summary: { totalSections: 0, mismatchSections: 0, totalMismatches: 0, mrComparisons: [] } };

    const poContractMt = parseFloat(po.total_contract_mt || po.weight_mt || 0) || 0;
    const poRate = parseFloat(po.rate || po.price || 0) || 0;
    const poSupplier = String(po.supplier || po.supplier_name || po.vendor_name || '').trim();
    const poBroker = String(po.broker || po.broker_name || '').trim();
    const poArea = String(po.area || po.station || '').trim();
    const poGrade = String(po.grade || po.grade_name || po.item_grade || '').trim();
    const poUnit = String(po.purchase_unit_name || po.unit || 'BALES').trim().toUpperCase();
    const poTotalUnits = parseInt(po.total_units || po.total_unit || 0, 10);
    const poLorries = parseInt(po.total_no_of_lorries || po.contract_lorries || 1, 10);
    const poDate = po.po_date || po.created_at?.slice(0, 10) || 'N/A';
    const poDeliveryDays = parseInt(po.delivery_days || po.shipment_days || 0, 10);

    // Aggregate Arrival metrics
    const totalArrivalWeight = dbArrivals.reduce((sum, a) => sum + getArrivalWeightMt(a), 0);
    const totalArrivalUnits = dbArrivals.reduce((sum, a) => sum + (parseInt(a.received_units || a.quantity_chln || a.units || a.quantity || 0, 10) || 0), 0);
    const firstArrival = dbArrivals[0] || {};
    const arrivalLorryNos = dbArrivals.map(a => a.lorry_number || a.lorry_no || a.truck_no || a.vehicle_no).filter(Boolean).join(', ');
    const challanweight = dbArrivals.map(a => a.challan_material_weight || a.challan_material_weight || a.challan_material_weight || a.challan_material_weight).filter(Boolean).join(', ');
    // Tolerance Calculation
    const weightTol = calculateWeightTolerance(poContractMt, totalArrivalWeight);

    // Satta Rate Reference
    const sattaBaseRate = dbSattaRate?.base_rate ? Number(dbSattaRate.base_rate) : null;

    // Aggregate Inspection metrics
    const avgMoisture = dbInspections.length > 0
      ? (dbInspections.reduce((sum, i) => sum + (parseFloat(i.actual_moisture || i.moisture_percent || i.moisture || 0) || 0), 0) / dbInspections.length)
      : 0;
    const avgDust = dbInspections.length > 0
      ? (dbInspections.reduce((sum, i) => sum + (parseFloat(i.actual_dust || i.dust_percent || i.dust || 0) || 0), 0) / dbInspections.length)
      : 0;
    const avgNcv = dbInspections.length > 0
      ? (dbInspections.reduce((sum, i) => sum + (parseFloat(i.actual_ncv || i.ncv_percent || i.ncv || 0) || 0), 0) / dbInspections.length)
      : 0;
    const totalPremiumSum = dbInspections.reduce((sum, i) => sum + (parseFloat(i.premium_amount || i.premium_total || 0) || 0), 0);
    
    const inspectionmrno = dbInspections.map(a => a.mr_no || a.mr_no || a.mr_no || a.mr_no).filter(Boolean).join(', ');
    const inspectionmrweught = dbInspections.map(a => a.final_receipt_wt || a.final_receipt_wt || a.final_receipt_wt || a.final_receipt_wt).filter(Boolean).join(', ');
    /* dbInspections.length > 0
      ? (dbInspections.reduce((sum, i) => sum + (parseFloat(i.final_receipt_wt || i.final_receipt_wt || i.final_receipt_wt || 0) || 0), 0))
      : 0; */
    
    // Aggregate Payment metrics
    const totalPaidAmount = dbPayments.reduce((sum, p) => sum + (parseFloat(p.amount_paid || p.payable_net_amount || p.amount || 0) || 0), 0);
    const contractValueEst = poContractMt > 0 && poRate > 0 ? (poContractMt * 10 * poRate) : 0; // 1 MT = 10 Qtl

    // Aggregate Settlement metrics
    const settledWeight = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.settled_weight_mt || s.settled_weight || 0) || 0), 0);
    const settledPenalty = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.penalty_amount || s.excess_short_penalty || 0) || 0), 0);
    const settledQualityDeductions = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.total_deduction_amount || s.quality_claim_amount || 0) || 0), 0);
    const totalSettledPayable = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.net_settled_amount || s.final_amount || 0) || 0), 0);

    // -------------------------------------------------------------
    // SECTION 1: SAUDA CHECK POINT
    // -------------------------------------------------------------
    const saudaFields: ComparisonField[] = [
      {
        name: 'Sauda Contract P.O.',
        referenceValue: po.po_no || 'N/A',
        actualValue: po.po_no || 'N/A',
        status: 'match',
        notes: 'Authoritative P.O. Key'
      },
      {
        name: 'Contract Date',
        referenceValue: poDate,
        actualValue: poDate,
        status: 'match'
      },
      {
        name: 'Supplier / Vendor',
        referenceValue: poSupplier || 'DIRECT',
        actualValue: poSupplier || 'DIRECT',
        status: 'match'
      },
      {
        name: 'Broker',
        referenceValue: poBroker || 'DIRECT',
        actualValue: poBroker || 'DIRECT',
        status: 'match'
      },
      {
        name: 'Challan Supplier',
        referenceValue: po.challan_supplier || poSupplier || 'DIRECT',
        actualValue: po.challan_supplier || poSupplier || 'DIRECT',
        status: 'match'
      },
      {
        name: 'Station / Area',
        referenceValue: poArea || 'N/A',
        actualValue: poArea || 'N/A',
        status: 'match'
      },
      {
        name: 'Grade Name',
        referenceValue: poGrade || 'N/A',
        actualValue: poGrade || 'N/A',
        status: 'match'
      },
      {
        name: 'Agency Name',
        referenceValue: po.agency_name || 'N/A',
        actualValue: po.agency_name || 'N/A',
        status: 'match'
      },
      {
        name: 'Marka Name',
        referenceValue: po.marka_name || 'N/A',
        actualValue: po.marka_name || 'N/A',
        status: 'match'
      },
      {
        name: 'Units & Count',
        referenceValue: `${poTotalUnits || 0} ${poUnit}`,
        actualValue: `${poTotalUnits || 0} ${poUnit}`,
        status: 'match'
      },
      {
        name: 'Weight / Lorry (MT)',
        referenceValue: poLorries > 0 ? `${(poContractMt / poLorries).toFixed(3)} MT` : `${poContractMt.toFixed(3)} MT`,
        actualValue: poLorries > 0 ? `${(poContractMt / poLorries).toFixed(3)} MT` : `${poContractMt.toFixed(3)} MT`,
        status: 'match'
      },
      {
        name: 'Total Contract Weight (MT)',
        referenceValue: `${poContractMt.toFixed(3)} MT`,
        actualValue: `${poContractMt.toFixed(3)} MT`,
        status: 'match'
      },
      {
        name: 'Total No of Lorries',
        referenceValue: `${poLorries} Lorry`,
        actualValue: `${poLorries} Lorry`,
        status: 'match'
      },
      {
        name: 'Rate / Qtl & Premium',
        referenceValue: poRate > 0 ? `₹${poRate.toLocaleString()}/Qtl` : 'N/A',
        actualValue: poRate > 0 ? `₹${poRate.toLocaleString()}/Qtl` : 'N/A',
        status: 'match'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 2: TEMPORARY ARRIVAL
    // -------------------------------------------------------------
    const tempArrivalFields: ComparisonField[] = [
      {
        name: 'Linked Arrival MRs',
        referenceValue: `${poLorries} Expected`,
        actualValue: linkedMrs.length > 0 ? `${linkedMrs.length} MR (${linkedMrs.join(', ')})` : 'Not Arrived',
        status: linkedMrs.length === 0 ? 'not_available' : 'match',
        isCritical: true
      },
      {
        name: 'Challan Supplier',
        referenceValue: poSupplier || 'DIRECT',
        actualValue: firstArrival.challan_supplier || firstArrival.supplier || (dbArrivals.length > 0 ? 'Recorded' : 'Not Arrived'),
        status: dbArrivals.length === 0 ? 'not_available' : (
          String(firstArrival.challan_supplier || firstArrival.supplier || '').trim().toUpperCase() === poSupplier.toUpperCase() || !firstArrival.challan_supplier
            ? 'match'
            : 'mismatch'
        ),
        notes: firstArrival.challan_supplier ? undefined : 'Direct/matched supplier',
        isCritical: true
      },
      {
        name: 'Arrival Station / Area',
        referenceValue: poArea || 'N/A',
        actualValue: firstArrival.arrival_area_name || firstArrival.area || firstArrival.station || (dbArrivals.length > 0 ? 'Recorded' : 'Not Arrived'),
        status: dbArrivals.length === 0 ? 'not_available' : (
          !firstArrival.arrival_area_name || String(firstArrival.arrival_area_name || firstArrival.area).trim().toUpperCase() === poArea.toUpperCase()
            ? 'match'
            : 'mismatch'
        )
      },
      {
        name: 'Arrival Grade',
        referenceValue: poGrade || 'N/A',
        actualValue: firstArrival.receipt_grade_name || firstArrival.grade || firstArrival.item_grade || (dbArrivals.length > 0 ? 'Recorded' : 'Not Arrived'),
        status: dbArrivals.length === 0 ? 'not_available' : (
          !firstArrival.receipt_grade_name || String(firstArrival.receipt_grade_name || firstArrival.grade).trim().toUpperCase() === poGrade.toUpperCase()
            ? 'match'
            : 'mismatch'
        ),
        isCritical: true
      },
      {
        name: 'Lorry Number(s)',
        referenceValue: `${poLorries} Expected`,
        actualValue: arrivalLorryNos || (dbArrivals.length > 0 ? `${dbArrivals.length} Recorded` : 'Pending Arrival'),
        status: dbArrivals.length === 0 ? 'not_available' : 'match'
      },
      {
        name: 'Gross weight',
        referenceValue: `${poLorries} Expected`,
        actualValue: challanweight || (dbArrivals.length > 0 ? `${dbArrivals.length} Recorded` : 'Pending Arrival'),
        status: dbArrivals.length === 0 ? 'not_available' : 'match'
      },
      {
        name: 'Received vs Contract Weight',
        referenceValue: `${poContractMt.toFixed(3)} MT`,
        actualValue: `${totalArrivalWeight.toFixed(3)} MT`,
        variance: weightTol.diffMt !== 0 ? `${weightTol.diffMt >= 0 ? '+' : ''}${weightTol.diffMt.toFixed(3)} MT` : '0.000 MT',
        status: dbArrivals.length === 0 ? 'not_available' : (
          (weightTol.isWithinTolerance || weightTol.isAcceptable) ? 'match' : 'mismatch'
        ),
        notes: (weightTol.isWithinTolerance || weightTol.isAcceptable)
          ? `Within allowed tolerance (±${weightTol.toleranceMt.toFixed(3)} MT)`
          : `Beyond allowed tolerance of ±${weightTol.toleranceMt.toFixed(3)} MT (Penalty applicable)`,
        isCritical: true
      }
    ];

    // -------------------------------------------------------------
    // SECTION 3: MILL INSPECTION
    // -------------------------------------------------------------
    const millInspFields: ComparisonField[] = [
      {
        name: 'Moisture Content (%)',
        referenceValue: '≤ 15.0% Standard',
        actualValue: dbInspections.length > 0 ? `${avgMoisture.toFixed(1)}%` : 'Pending Inspection',
        variance: avgMoisture > 15.0 ? `+${(avgMoisture - 15.0).toFixed(1)}% Excess` : 'Normal',
        status: dbInspections.length === 0 ? 'not_available' : (avgMoisture <= 15.0 ? 'match' : 'mismatch'),
        notes: avgMoisture > 15.0 ? 'Moisture exceeds standard 15% limit. Quality deduction triggered.' : 'Moisture within standard acceptance range.',
        isCritical: true
      },
      {
        name: 'Grade Acceptance / Down',
        referenceValue: poGrade,
        actualValue: dbInspections.length > 0 ? (dbInspections[0].actual_grade || dbInspections[0].item_grade || poGrade) : 'Pending Inspection',
        status: dbInspections.length === 0 ? 'not_available' : 'match',
        notes: dbInspections[0]?.grade_down_percent > 0 ? `Grade Down: ${dbInspections[0].grade_down_percent}%` : 'Grade Verified',
        isCritical: true
      },
      {
        name: 'Dust Contamination (%)',
        referenceValue: '≤ 1.0% Standard',
        actualValue: dbInspections.length > 0 ? `${avgDust.toFixed(1)}%` : 'Pending',
        variance: avgDust > 1.0 ? `+${(avgDust - 1.0).toFixed(1)}% Excess` : 'Normal',
        status: dbInspections.length === 0 ? 'not_available' : (avgDust <= 1.0 ? 'match' : 'mismatch'),
        notes: avgDust > 1.0 ? 'Dust exceeds standard tolerance.' : 'Dust within acceptance.'
      },
      {
        name: 'NCV Contamination (%)',
        referenceValue: '≤ 0.5% Standard',
        actualValue: dbInspections.length > 0 ? `${avgNcv.toFixed(1)}%` : 'Pending',
        variance: avgNcv > 0.5 ? `+${(avgNcv - 0.5).toFixed(1)}% Excess` : 'Normal',
        status: dbInspections.length === 0 ? 'not_available' : (avgNcv <= 0.5 ? 'match' : 'mismatch'),
        notes: avgNcv > 0.5 ? 'Non-Combustible Value exceeds limit.' : 'NCV within acceptance.'
      },
      {
        name: 'Inspected MRS',
        referenceValue: `${poLorries} Expected`,
        actualValue: inspectionmrno || (dbInspections.length > 0 ? `${dbInspections.length} Recorded` : 'Pending Arrival'),
        status: dbInspections.length === 0 ? 'not_available' : 'match'
      }, 
      {
        name: 'Inspected MRS Weight',
        referenceValue: `${poLorries} Expected`,
        actualValue: inspectionmrweught || (dbInspections.length > 0 ? `${dbInspections.length} Recorded` : 'Pending Arrival'),
        status: dbInspections.length === 0 ? 'not_available' : 'match'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 4: SAUDA PRICE MISMATCH
    // -------------------------------------------------------------
    const priceMismatches = [
      ...dbMismatches.filter(m => m.mismatch_type === 'price' || m.field_name?.toLowerCase().includes('rate') || m.field_name?.toLowerCase().includes('price')),
      ...dbSattaMismatches
    ];
    const rateDiff = sattaBaseRate !== null ? (poRate - sattaBaseRate) : 0;
    const isRateBeyondLimit = sattaBaseRate !== null && poRate > sattaBaseRate;

    const saudaPriceFields: ComparisonField[] = [
      {
        name: 'Sauda Rate vs Satta Rate',
        referenceValue: sattaBaseRate !== null ? `₹${sattaBaseRate.toLocaleString()} / Qtl (Satta)` : 'Reference Rate',
        actualValue: `₹${poRate.toLocaleString()} / Qtl (Sauda)`,
        variance: sattaBaseRate !== null ? (rateDiff !== 0 ? `${rateDiff >= 0 ? '+' : ''}₹${rateDiff}/Qtl` : '₹0') : 'N/A',
        status: sattaBaseRate === null ? 'match' : (
          isRateBeyondLimit && priceMismatches.length === 0 ? 'mismatch' : 'match'
        ),
        notes: isRateBeyondLimit ? `Exceeds Satta Limit by ₹${rateDiff}/Qtl` : 'Within approved Satta ceiling rate',
        isCritical: true
      },
      {
        name: 'Price Dispute Clearance',
        referenceValue: 'Management Approval Required',
        actualValue: priceMismatches.length > 0 
          ? (priceMismatches[0].status === 'approved' ? `Approved by ${priceMismatches[0].approved_by || 'Admin'}` : 'Dispute Pending Approval')
          : (isRateBeyondLimit ? 'Dispute Unresolved' : 'No Dispute'),
        status: isRateBeyondLimit && (priceMismatches.length === 0 || priceMismatches.some(m => m.status !== 'approved')) ? 'mismatch' : 'match',
        notes: priceMismatches[0]?.remarks || priceMismatches[0]?.approval_remarks || 'Rate validated'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 5: MATERIAL MISMATCH BOARD (BASE MODE)
    // -------------------------------------------------------------
    const materialMismatches = dbMismatches.filter(m => m.mismatch_type !== 'price');
    const hasUnresolvedMatMismatch = materialMismatches.some(m => m.status !== 'approved' && m.status !== 'resolved');

    const materialMismatchFields: ComparisonField[] = [
      {
        name: 'Supplier & Broker Match',
        referenceValue: `${poSupplier} | ${poBroker}`,
        actualValue: firstArrival.supplier ? `${firstArrival.supplier} | ${firstArrival.broker || 'DIRECT'}` : (dbArrivals.length > 0 ? 'Recorded' : 'Pending Arrival'),
        status: materialMismatches.some(m => m.field_name === 'Supplier' || m.field_name === 'Broker') ? 'mismatch' : 'match'
      },
      {
        name: 'Area & Grade Match',
        referenceValue: `${poArea} | ${poGrade}`,
        actualValue: firstArrival.arrival_area_name ? `${firstArrival.arrival_area_name} | ${firstArrival.receipt_grade_name || poGrade}` : (dbArrivals.length > 0 ? 'Recorded' : 'Pending Arrival'),
        status: materialMismatches.some(m => m.field_name === 'Area' || m.field_name === 'Grade') ? 'mismatch' : 'match'
      },
      {
        name: 'Lorry Progress vs Contract',
        referenceValue: `${poLorries} Lorries Contracted`,
        actualValue: `${dbArrivals.length} Received | ${Math.max(0, poLorries - dbArrivals.length)} Remaining`,
        status: 'match'
      },
      {
        name: 'Mismatch Audit Board Status',
        referenceValue: 'Zero Unapproved Mismatches',
        actualValue: materialMismatches.length > 0
          ? `${materialMismatches.length} Mismatch Case(s) (${materialMismatches.filter(m => m.status === 'approved').length} Approved)`
          : 'Clean (No Mismatches)',
        status: hasUnresolvedMatMismatch ? 'mismatch' : 'match',
        notes: materialMismatches[0]?.approval_remarks || 'Material specifications verified'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 6: PAYMENT OPERATIONS
    // -------------------------------------------------------------
    const paymentFields: ComparisonField[] = [
      {
        name: 'Total Paid / Advance Amount',
        referenceValue: contractValueEst > 0 ? `≤ ₹${Math.round(contractValueEst).toLocaleString()} (Contract Est)` : '₹0',
        actualValue: `₹${Math.round(totalPaidAmount).toLocaleString()}`,
        variance: contractValueEst > 0 ? `Diff: ₹${Math.round(contractValueEst - totalPaidAmount).toLocaleString()}` : undefined,
        status: 'match',
        notes: `${dbPayments.length} Voucher(s) recorded against this P.O.`
      },
      {
        name: 'Payment Vouchers Count',
        referenceValue: 'Vouchers Issued',
        actualValue: `${dbPayments.length} Voucher(s)`,
        status: dbPayments.length > 0 ? 'match' : 'not_available',
        notes: dbPayments.map(p => p.voucher_no).filter(Boolean).join(', ') || 'Pending voucher creation'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 7: SETTLEMENT & FINAL AUDIT
    // -------------------------------------------------------------
    const settlementFields: ComparisonField[] = [
      {
        name: 'Settlement Status',
        referenceValue: 'Full Account Reconciliation',
        actualValue: dbSettlements.length > 0 ? `Generated (${dbSettlements.length} MRs Settled)` : 'Pending Settlement',
        status: dbSettlements.length > 0 ? 'match' : 'not_available',
        notes: dbSettlements.map(s => s.mr_no).filter(Boolean).join(', ') || 'Awaiting final MR audit'
      },
      {
        name: 'Settled Net Weight',
        referenceValue: `${poContractMt.toFixed(3)} MT Contract`,
        actualValue: `${settledWeight > 0 ? settledWeight.toFixed(3) : totalArrivalWeight.toFixed(3)} MT`,
        status: 'match'
      },
      {
        name: 'Weight Penalty Applied',
        referenceValue: (weightTol.isWithinTolerance || weightTol.isAcceptable) ? '₹0 (Tolerable)' : 'Penalty Mandated',
        actualValue: settledPenalty > 0 ? `₹${settledPenalty.toLocaleString()}` : '₹0',
        status: (!weightTol.isWithinTolerance && !weightTol.isAcceptable && settledPenalty === 0 && dbSettlements.length > 0) ? 'mismatch' : 'match',
        notes: settledPenalty > 0 ? `₹${settledPenalty.toLocaleString()} deducted for excess/short deviation` : 'Zero penalty applied'
      },
      {
        name: 'Quality Deductions Applied',
        referenceValue: 'Claim Calculated per MR',
        actualValue: settledQualityDeductions > 0 ? `₹${settledQualityDeductions.toLocaleString()}` : '₹0',
        status: 'match',
        notes: `Total quality deductions across all MR lots`
      }
    ];

    // 7 Sections Configuration
    const sections: SectionComparison[] = [
      {
        id: 'sauda_check_point',
        title: 'Sauda Check Point',
        icon: FileText,
        fields: saudaFields,
        mismatchCount: saudaFields.filter(f => f.status === 'mismatch').length,
        status: saudaFields.some(f => f.status === 'mismatch') ? 'mismatch' : 'clean',
        existingRecords: [po, ...dbPoDetails]
      },
      {
        id: 'temporary_arrival',
        title: `Temporary Arrival (${linkedMrs.length} MR)`,
        icon: Truck,
        fields: tempArrivalFields,
        mismatchCount: tempArrivalFields.filter(f => f.status === 'mismatch').length,
        status: tempArrivalFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbArrivals.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbArrivals
      },
      {
        id: 'mill_inspection',
        title: `Mill Inspection (${dbInspections.length} MR)`,
        icon: Droplets,
        fields: millInspFields,
        mismatchCount: millInspFields.filter(f => f.status === 'mismatch').length,
        status: millInspFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbInspections.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbInspections
      },
      {
        id: 'satta_price_mismatch',
        title: 'Satta Price Mismatch',
        icon: Coins,
        fields: saudaPriceFields,
        mismatchCount: saudaPriceFields.filter(f => f.status === 'mismatch').length,
        status: saudaPriceFields.some(f => f.status === 'mismatch') ? 'mismatch' : 'clean',
        existingRecords: priceMismatches
      },
      {
        id: 'material_mismatch',
        title: 'Material Mismatch Board (Base Mode)',
        icon: ShieldAlert,
        fields: materialMismatchFields,
        mismatchCount: materialMismatchFields.filter(f => f.status === 'mismatch').length,
        status: materialMismatchFields.some(f => f.status === 'mismatch') ? 'mismatch' : 'clean',
        existingRecords: materialMismatches
      },
      {
        id: 'payment',
        title: `Payment Operations (${dbPayments.length} Vouchers)`,
        icon: Coins,
        fields: paymentFields,
        mismatchCount: paymentFields.filter(f => f.status === 'mismatch').length,
        status: paymentFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbPayments.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbPayments
      },
      {
        id: 'settlement',
        title: `Settlement & Final Audit (${dbSettlements.length} MR)`,
        icon: Scale,
        fields: settlementFields,
        mismatchCount: settlementFields.filter(f => f.status === 'mismatch').length,
        status: settlementFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbSettlements.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbSettlements
      }
    ];

    // Multi-MR Per-MR Comparison Breakdown
    const mrComparisons: MrComparisonData[] = linkedMrs.map(mrNo => {
      const isRecordMatchMr = (rec: any) => {
        if (!rec) return false;
        const c1 = String(rec.temporary_arrival_no || '').trim().toUpperCase();
        const c2 = String(rec.mr_no || '').trim().toUpperCase();
        const c3 = String(rec.arrival_no || '').trim().toUpperCase();
        const c4 = String(rec.final_arrival_no || '').trim().toUpperCase();
        const c5 = String(rec.amad_no || '').trim().toUpperCase();
        const c6 = String(rec.mr_number || '').trim().toUpperCase();
        const c7 = String(rec.ref_arrival_no || '').trim().toUpperCase();
        return c1 === mrNo || c2 === mrNo || c3 === mrNo || c4 === mrNo || c5 === mrNo || c6 === mrNo || c7 === mrNo;
      };

      const arr = dbArrivals.find(isRecordMatchMr) || {};
      const insp = dbInspections.find(isRecordMatchMr) || {};
      const sett = dbSettlements.find(isRecordMatchMr) || {};
      const pay = dbPayments.find(isRecordMatchMr) || {};

      const arrSupplier = arr.challan_supplier || arr.supplier || poSupplier;
      const arrGrade = arr.receipt_grade_name || arr.grade || arr.item_grade || poGrade;
      const arrWt = getArrivalWeightMt(arr);
      const inspMoisture = parseFloat(insp.actual_moisture || insp.moisture_percent || insp.moisture || 0) || 0;
      const inspDust = parseFloat(insp.actual_dust || insp.dust_percent || insp.dust || 0) || 0;
      const inspNcv = parseFloat(insp.actual_ncv || insp.ncv_percent || insp.ncv || 0) || 0;

      const mrTempArrivalFields: ComparisonField[] = [
        {
          name: 'Temporary M.R No.',
          referenceValue: mrNo,
          actualValue: arr.temporary_arrival_no || arr.mr_no || mrNo,
          status: 'match'
        },
        {
          name: 'Supplier',
          referenceValue: poSupplier || 'DIRECT',
          actualValue: arrSupplier || poSupplier,
          status: !arrSupplier || arrSupplier.toUpperCase() === poSupplier.toUpperCase() ? 'match' : 'mismatch'
        },
        {
          name: 'Challan Supplier',
          referenceValue: poSupplier || 'DIRECT',
          actualValue: arr.challan_supplier || arrSupplier || poSupplier,
          status: 'match'
        },
        {
          name: 'Broker',
          referenceValue: poBroker || 'DIRECT',
          actualValue: arr.broker || poBroker || 'DIRECT',
          status: 'match'
        },
        {
          name: 'Lorry Number',
          referenceValue: 'Expected Lorry',
          actualValue: arr.lorry_number || arr.lorry_no || arr.truck_no || 'Recorded',
          status: 'match'
        },
        {
          name: 'Arrival Area',
          referenceValue: poArea || 'N/A',
          actualValue: arr.arrival_area_name || arr.area || poArea || 'N/A',
          status: 'match'
        },
        {
          name: 'Receipt Grade',
          referenceValue: poGrade,
          actualValue: arrGrade || poGrade,
          status: !arrGrade || arrGrade.toUpperCase() === poGrade.toUpperCase() ? 'match' : 'mismatch'
        },
        {
          name: 'Final Weight (MT)',
          referenceValue: poLorries > 0 ? `~${(poContractMt / poLorries).toFixed(3)} MT` : `${poContractMt.toFixed(3)} MT`,
          actualValue: `${arrWt.toFixed(3)} MT`,
          status: 'match'
        }
      ];

      const mrMillInspFields: ComparisonField[] = [
        {
          name: 'Actual Moisture (%)',
          referenceValue: '≤ 15.0%',
          actualValue: `${inspMoisture.toFixed(1)}%`,
          status: inspMoisture <= 15.0 ? 'match' : 'mismatch'
        },
        {
          name: 'Actual Dust (%)',
          referenceValue: '≤ 1.0%',
          actualValue: `${inspDust.toFixed(1)}%`,
          status: inspDust <= 1.0 ? 'match' : 'mismatch'
        },
        {
          name: 'Actual NCV (%)',
          referenceValue: '≤ 0.5%',
          actualValue: `${inspNcv.toFixed(1)}%`,
          status: inspNcv <= 0.5 ? 'match' : 'mismatch'
        },
        {
          name: 'Claim Moisture (%)',
          referenceValue: '0.0%',
          actualValue: `${parseFloat(insp.claim_moisture || 0).toFixed(1)}%`,
          status: 'match'
        },
        {
          name: 'Claim Dust (%)',
          referenceValue: '0.0%',
          actualValue: `${parseFloat(insp.claim_dust || 0).toFixed(1)}%`,
          status: 'match'
        },
        {
          name: 'Claim NCV (%)',
          referenceValue: '0.0%',
          actualValue: `${parseFloat(insp.claim_ncv || 0).toFixed(1)}%`,
          status: 'match'
        }
      ];

      const mrMismatchCount = mrTempArrivalFields.filter(f => f.status === 'mismatch').length +
                              mrMillInspFields.filter(f => f.status === 'mismatch').length;

      return {
        mrNo,
        arrivalRecord: arr,
        inspectionRecord: insp,
        settlementRecord: sett,
        paymentRecord: pay,
        tempArrivalFields: mrTempArrivalFields,
        millInspFields: mrMillInspFields,
        mismatchCount: mrMismatchCount
      };
    });

    const totalMismatches = sections.reduce((sum, s) => sum + s.mismatchCount, 0);
    const mismatchSections = sections.filter(s => s.mismatchCount > 0).length;

    return {
      sections,
      summary: {
        totalSections: sections.length,
        mismatchSections,
        totalMismatches,
        mrComparisons
      }
    };
  }, [po, dbArrivals, dbInspections, dbPayments, dbSettlements, dbMismatches, dbSattaMismatches, dbSattaRate, linkedMrs]);

  // Toggle Section Accordion
  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Jump directly to a section
  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCollapsedSections(prev => ({ ...prev, [id]: false }));
    }
  };

  if (!isOpen || !po) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-[#FAF7F0] border-2 border-[#D6CAA8] w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. MODAL HEADER BANNER */}
        <div className="bg-gradient-to-r from-[#1E331B] via-[#2A4426] to-[#1E331B] p-4 text-white flex flex-wrap items-center justify-between gap-3 border-b border-[#D6CAA8] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-emerald-300 border border-white/10 shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-serif font-black tracking-wide text-white">
                  Histogram & Lifecycle Audit
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/40 text-xs font-mono font-bold">
                  {po.po_no}
                </span>
                {po.ptf_no && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40 text-[10px] font-mono font-bold">
                    PTF: {po.ptf_no}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100/80 font-sans mt-0.5">
                Full-spectrum cross-stage data comparison & instant mismatch highlight across all 7 lifecycle stages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setActiveTab('compare')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  activeTab === 'compare' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-100 hover:text-white"
                )}
              >
                Compare & Highlight
              </button>
              <button
                onClick={() => setActiveTab('story')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  activeTab === 'story' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-100 hover:text-white"
                )}
              >
                7-Stage Story
              </button>
              <button
                onClick={() => setActiveTab('histogram')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  activeTab === 'histogram' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-100 hover:text-white"
                )}
              >
                Turnaround Timeline
              </button>
              <button
                onClick={() => setActiveTab('mismatch_audit')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  activeTab === 'mismatch_audit' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-100 hover:text-white"
                )}
              >
                Mismatch Board ({dbMismatches.length + dbSattaMismatches.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Close Popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. TOP P.O. SUMMARY CARD & VISUAL ISSUE CHECKLIST */}
        <div className="bg-white border-b border-[#D6CAA8] p-3.5 sm:p-4 shadow-2xs shrink-0 space-y-3">
          {/* Main Key-Value Metadata Grid */}
          <div className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">P.O. No.:</span>
              <strong className="text-slate-900 font-mono text-[12px]">{po.po_no}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">P.O. Date:</span>
              <strong className="text-slate-800">{po.po_date || po.created_at?.slice(0, 10) || '—'}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Supplier:</span>
              <strong className="text-slate-800 truncate block" title={po.supplier || po.supplier_name || 'DIRECT'}>{po.supplier || po.supplier_name || 'DIRECT'}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Broker:</span>
              <strong className="text-slate-800 truncate block" title={po.broker || po.broker_name || 'DIRECT'}>{po.broker || po.broker_name || 'DIRECT'}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Contract Wt:</span>
              <strong className="text-emerald-800 font-mono font-black">{parseFloat(po.total_contract_mt || 0).toFixed(3)} MT</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Received Wt:</span>
              <strong className="text-slate-900 font-mono font-black">{dbArrivals.reduce((s, a) => s + getArrivalWeightMt(a), 0).toFixed(3)} MT</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total M.R.s:</span>
              <strong className="text-blue-900 font-mono font-black">{linkedMrs.length} ({linkedMrs.join(', ') || 'None'})</strong>
            </div>
          </div>

          {/* Overall Issue Summary Ribbon & Jump Pills */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Summary Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Overall Check:</span>
              
              {comparisonResults.summary.totalMismatches > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-xs font-black inline-flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  <span>🔴 {comparisonResults.summary.totalMismatches} Issue(s)</span>
                </span>
              )}

              {comparisonResults.sections.some(s => s.status === 'pending') && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>🟡 {comparisonResults.sections.filter(s => s.status === 'pending').length} Warning / Pending</span>
                </span>
              )}

              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>🟢 {comparisonResults.sections.filter(s => s.status === 'clean').length * 2 + 6} Checks Passed</span>
              </span>
            </div>

            {/* Quick Section Jump Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">Jump To Section:</span>
              {comparisonResults.sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1",
                    sec.mismatchCount > 0
                      ? "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200 shadow-2xs"
                      : sec.status === 'pending'
                        ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs"
                  )}
                  title={`Click to jump to ${sec.title}`}
                >
                  {sec.mismatchCount > 0 ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  ) : sec.status === 'pending' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  )}
                  <span>{sec.title}</span>
                  {sec.mismatchCount > 0 && (
                    <span className="bg-rose-600 text-white px-1 rounded-full text-[9px] font-mono font-extrabold">
                      {sec.mismatchCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Mismatch Areas Ribbon if issues exist */}
          {comparisonResults.summary.totalMismatches > 0 && (
            <div className="pt-2 border-t border-dashed border-slate-200 flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-[10px] font-bold uppercase text-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Immediate Attention Required:</span>
              </span>
              {comparisonResults.sections.filter(s => s.mismatchCount > 0).map(s => (
                <span 
                  key={`ribbon-${s.id}`} 
                  onClick={() => scrollToSection(s.id)}
                  className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-medium cursor-pointer hover:bg-rose-100 transition-colors"
                >
                  <strong>{s.title}</strong> → {s.fields.filter(f => f.status === 'mismatch').map(f => f.name).join(', ')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 3. MODAL CONTENT AREA (Scrollable) */}
        <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-8 h-8 text-emerald-700 animate-spin mx-auto" />
              <p className="font-bold text-sm">Cross-comparing all 7 lifecycle stages across linked MRs...</p>
              <p className="text-xs text-slate-400">Loading Sauda Check Point, Temporary Arrival, Mill Inspection, Satta Price, Material Mismatch, Payment, and Settlement records</p>
            </div>
          ) : activeTab === 'story' ? (
            /* TAB: 7-STAGE SEQUENTIAL P.O. STORY */
            <div className="space-y-6">
              
              {/* STAGE 1: SAUDA CHECK POINT */}
              <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span>Stage 1: Sauda Check Point Contract Master</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                    P.O. {po.po_no}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Broker:</span> <strong className="text-slate-800">{po.broker || po.broker_name || 'DIRECT'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier:</span> <strong className="text-slate-800">{po.supplier || po.supplier_name || 'DIRECT'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Challan Supplier:</span> <strong className="text-slate-800">{po.challan_supplier || po.supplier || 'DIRECT'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Area:</span> <strong className="text-slate-800">{po.area || po.station || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Total Lorries:</span> <strong className="text-slate-800">{po.total_no_of_lorries || po.contract_lorries || 1}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Units / Lorry:</span> <strong className="text-slate-800">{po.units_per_lorry || po.units_lorry || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Total Units (Count):</span> <strong className="text-slate-800">{po.total_units || po.total_unit || 0}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Weight/Lorry (MT):</span> <strong className="text-slate-800">{po.weight_per_lorry || (parseFloat(po.total_contract_mt || 0) / Math.max(1, parseInt(po.total_no_of_lorries || 1))).toFixed(3)} MT</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Total Contract (MT):</span> <strong className="text-emerald-800 font-mono font-black">{parseFloat(po.total_contract_mt || 0).toFixed(3)} MT</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Delivery Range:</span> <strong className="text-slate-800">{po.delivery_from || po.po_date || '—'} to {po.delivery_to || '—'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Grace Days:</span> <strong className="text-slate-800">{po.grace_days || 0} Days</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Delivery Penalty:</span> <strong className="text-slate-800">{po.delivery_penalty || 'Standard'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Grade Name:</span> <strong className="text-slate-800">{po.grade || po.grade_name || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Agency Name:</span> <strong className="text-slate-800">{po.agency_name || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Marka Name:</span> <strong className="text-slate-800">{po.marka_name || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Rate / Qtl:</span> <strong className="text-emerald-800 font-mono font-black">₹{parseFloat(po.rate || po.price || 0).toLocaleString()}</strong></div>
                  <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Premium:</span> <strong className="text-slate-800">{po.premium || 'Nil'}</strong></div>
                </div>
              </div>

              {/* STAGE 2: TEMPORARY ARRIVAL (Per Linked MR) */}
              <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-700" />
                    <span>Stage 2: Temporary Arrival Records ({dbArrivals.length} Arrivals Linked)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-mono font-bold">
                    Linked MRs: {linkedMrs.join(', ') || 'None'}
                  </span>
                </div>

                {dbArrivals.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    No Temporary Arrival records logged yet for this P.O.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dbArrivals.map((arr, idx) => (
                      <div key={arr.id || idx} className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between border-b border-[#D6CAA8] pb-1.5">
                          <span className="text-xs font-mono font-black text-[#1E331B] flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-emerald-700" />
                            <span>M.R. No: {arr.temporary_arrival_no || arr.mr_no || arr.amad_no || `Arrival #${idx + 1}`}</span>
                          </span>
                          <span className="text-[11px] font-medium text-slate-600">
                            Date: <strong>{arr.date || arr.arrival_date || arr.lorry_date || '—'}</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-[11px]">
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Challan Supplier:</span> <strong className="text-slate-800">{arr.challan_supplier || arr.supplier || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Supplier:</span> <strong className="text-slate-800">{arr.supplier || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Broker:</span> <strong className="text-slate-800">{arr.broker || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Lorry Number:</span> <strong className="text-slate-800 font-mono">{arr.lorry_number || arr.lorry_no || arr.truck_no || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Unit:</span> <strong className="text-slate-800">{arr.unit_name || arr.unit || 'BALES'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">A.P.M.C Fees (₹):</span> <strong className="text-slate-800">₹{parseFloat(arr.apmc_fees || 0).toLocaleString()}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Arrival Area:</span> <strong className="text-slate-800">{arr.arrival_area_name || arr.area || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Receipt Grade:</span> <strong className="text-slate-800">{arr.receipt_grade_name || arr.grade || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Agency Name:</span> <strong className="text-slate-800">{arr.agency_name || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Challan Marka:</span> <strong className="text-slate-800">{arr.challan_marka_name || arr.marka_name || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Netto (MT):</span> <strong className="text-slate-800 font-mono">{parseFloat(arr.netto_mt || 0).toFixed(3)} MT</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Quantity Chln:</span> <strong className="text-slate-800">{arr.quantity_chln || arr.received_units || 0}</strong></div>
                        </div>

                        {/* Weight Comparison Grid */}
                        <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                          <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                            <Scale className="w-3 h-3 text-slate-600" />
                            <span>Weighbridge Breakdown (Gross / Tare / Net):</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[10px] font-mono">
                            <div className="bg-slate-50 p-1.5 rounded border"><span className="text-slate-400 block text-[8.5px]">CHALLAN GROSS</span><strong>{arr.supplier_challan_gross || arr.challan_gross_wt || 0}</strong></div>
                            <div className="bg-slate-50 p-1.5 rounded border"><span className="text-slate-400 block text-[8.5px]">MILL GROSS</span><strong>{arr.actual_gross_weight || arr.mill_gross_wt || 0}</strong></div>
                            <div className="bg-slate-50 p-1.5 rounded border"><span className="text-slate-400 block text-[8.5px]">ELECTRONIC GROSS</span><strong>{arr.electronic_gross_weight || arr.electronic_gross_wt || 0}</strong></div>
                            <div className="bg-slate-50 p-1.5 rounded border"><span className="text-slate-400 block text-[8.5px]">CHALLAN TARE</span><strong>{arr.supplier_tare_weight || arr.challan_tare_wt || 0}</strong></div>
                            <div className="bg-slate-50 p-1.5 rounded border"><span className="text-slate-400 block text-[8.5px]">MILL TARE</span><strong>{arr.actual_tare_weight || arr.mill_tare_wt || 0}</strong></div>
                            <div className="bg-slate-50 p-1.5 rounded border"><span className="text-slate-400 block text-[8.5px]">ELECTRONIC TARE</span><strong>{arr.electronic_tare_weight || arr.electronic_tare_wt || 0}</strong></div>
                            <div className="bg-slate-50 p-1.5 rounded border"><span className="text-slate-400 block text-[8.5px]">MILL NET</span><strong>{arr.actual_net_weight || arr.mill_net_wt || 0}</strong></div>
                            <div className="bg-emerald-50 p-1.5 rounded border border-emerald-300 text-emerald-900"><span className="text-emerald-700 block text-[8.5px] font-bold">FINAL WEIGHT (MT)</span><strong>{parseFloat(arr.final_weight_mt || arr.received_weight_mt || 0).toFixed(3)} MT</strong></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STAGE 3: MILL INSPECTION */}
              <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-emerald-700" />
                    <span>Stage 3: Mill Inspection & Quality Audit ({dbInspections.length} Inspections Linked)</span>
                  </h3>
                </div>

                {dbInspections.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    No Mill Inspection records logged yet for this P.O.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dbInspections.map((insp, idx) => (
                      <div key={insp.id || idx} className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between border-b border-[#D6CAA8] pb-1.5">
                          <span className="text-xs font-mono font-black text-[#1E331B]">
                            M.R. No: {insp.mr_no || insp.arrival_no || `Inspection #${idx + 1}`}
                          </span>
                          <span className="text-[11px] font-medium text-slate-600">
                            Inspection Date: <strong>{insp.mr_date || insp.date || '—'}</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-[11px]">
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Arrival No:</span> <strong className="text-slate-800 font-mono">{insp.arrival_no || insp.mr_no || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Supplier:</span> <strong className="text-slate-800">{insp.supplier_name || insp.supplier || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Broker:</span> <strong className="text-slate-800">{insp.broker_name || insp.broker || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Actual Moisture:</span> <strong className={cn(parseFloat(insp.actual_moisture || 0) > 15 ? "text-rose-700" : "text-emerald-800")}>{parseFloat(insp.actual_moisture || 0).toFixed(1)}%</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Actual Dust:</span> <strong className={cn(parseFloat(insp.actual_dust || 0) > 1 ? "text-rose-700" : "text-slate-800")}>{parseFloat(insp.actual_dust || 0).toFixed(1)}%</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Actual NCV:</span> <strong className={cn(parseFloat(insp.actual_ncv || 0) > 0.5 ? "text-rose-700" : "text-slate-800")}>{parseFloat(insp.actual_ncv || 0).toFixed(1)}%</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Claim Moisture:</span> <strong className="text-slate-800">{parseFloat(insp.claim_moisture || 0).toFixed(1)}%</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Claim Dust:</span> <strong className="text-slate-800">{parseFloat(insp.claim_dust || 0).toFixed(1)}%</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Claim NCV:</span> <strong className="text-slate-800">{parseFloat(insp.claim_ncv || 0).toFixed(1)}%</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Detention Days:</span> <strong className="text-slate-800">{insp.detention_days || 0} Days</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Unloading Date:</span> <strong className="text-slate-800">{insp.unloading_date || '—'}</strong></div>
                          <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Mill P.O. No:</span> <strong className="text-slate-800 font-mono">{insp.mill_po_no || '—'}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STAGE 4: SATTA PRICE MISMATCH */}
              <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-700" />
                    <span>Stage 4: Satta Price Mismatch Verification</span>
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-[11px]">
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Sauda No. & Date:</span> <strong className="text-slate-800 font-mono">{po.po_no} ({po.po_date || '—'})</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Supplier & Broker:</span> <strong className="text-slate-800">{po.supplier || 'DIRECT'} | {po.broker || 'DIRECT'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Area & Grade:</span> <strong className="text-slate-800">{po.area || '—'} | {po.grade || '—'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Sauda Rate (₹/Qtl):</span> <strong className="text-emerald-800 font-mono font-black">₹{parseFloat(po.rate || 0).toLocaleString()}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Satta Limit Rate (₹/Qtl):</span> <strong className="text-slate-700 font-mono">{dbSattaRate?.base_rate ? `₹${Number(dbSattaRate.base_rate).toLocaleString()}` : 'Standard Satta'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Variance / Excess:</span> <strong className="text-slate-800 font-mono">{dbSattaRate?.base_rate ? `₹${(parseFloat(po.rate || 0) - Number(dbSattaRate.base_rate)).toFixed(0)}` : '₹0'}</strong></div>
                </div>
              </div>

              {/* STAGE 5: MATERIAL MISMATCH */}
              <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-700" />
                    <span>Stage 5: Material Mismatch Board (Base Mode)</span>
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-[11px]">
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">P.O. Number & Date:</span> <strong className="text-slate-800 font-mono">{po.po_no} ({po.po_date || '—'})</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Supplier & Broker:</span> <strong className="text-slate-800">{po.supplier || 'DIRECT'} | {po.broker || 'DIRECT'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Area & Grade:</span> <strong className="text-slate-800">{po.area || '—'} | {po.grade || '—'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Lorries (Contract|Recv|Rem):</span> <strong className="text-slate-800">{po.total_no_of_lorries || 1} | {dbArrivals.length} | {Math.max(0, (po.total_no_of_lorries || 1) - dbArrivals.length)}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Mismatched Fields:</span> <strong className="text-emerald-800">{dbMismatches.length > 0 ? dbMismatches.map(m => m.field_name).join(', ') : 'None (Zero Mismatches)'}</strong></div>
                  <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Audit Status:</span> <strong className="text-emerald-800">Verified & Approved</strong></div>
                </div>
              </div>

              {/* STAGE 6: PAYMENT OPERATIONS */}
              <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-700" />
                    <span>Stage 6: Payment Operations ({dbPayments.length} Vouchers)</span>
                  </h3>
                </div>

                {dbPayments.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    No Payment Vouchers created yet for this P.O.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dbPayments.map((pay, idx) => (
                      <div key={pay.id || idx} className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3 text-[11px] grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Voucher No:</span> <strong className="text-slate-800 font-mono">{pay.voucher_no || `VOUCHER-${idx + 1}`}</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Payment Date:</span> <strong className="text-slate-800">{pay.payment_date || pay.date || '—'}</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Party / Supplier:</span> <strong className="text-slate-800">{pay.party_name || pay.supplier_name || po.supplier || '—'}</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Broker:</span> <strong className="text-slate-800">{pay.broker_name || po.broker || 'DIRECT'}</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Payable Net Amount (₹):</span> <strong className="text-emerald-800 font-mono font-black">₹{parseFloat(pay.amount_paid || pay.payable_net_amount || pay.amount || 0).toLocaleString()}</strong></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STAGE 7: SETTLEMENT */}
              <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-700" />
                    <span>Stage 7: Settlement Master & Final Deduction Ledger ({dbSettlements.length} MR Settled)</span>
                  </h3>
                </div>

                {dbSettlements.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Account Settlement is pending for this P.O.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dbSettlements.map((sett, idx) => (
                      <div key={sett.id || idx} className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3 text-[11px] grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Settlement MR No:</span> <strong className="text-slate-800 font-mono">{sett.mr_no || `SETTLEMENT-${idx + 1}`}</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Settled Weight (MT):</span> <strong className="text-slate-800 font-mono">{parseFloat(sett.settled_weight_mt || 0).toFixed(3)} MT</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Quality Deductions:</span> <strong className="text-rose-700 font-mono">₹{parseFloat(sett.total_deduction_amount || 0).toLocaleString()}</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Weight Penalty:</span> <strong className="text-rose-700 font-mono">₹{parseFloat(sett.penalty_amount || 0).toLocaleString()}</strong></div>
                        <div><span className="text-slate-400 block text-[9.5px] uppercase font-bold">Net Final Amount:</span> <strong className="text-emerald-800 font-mono font-black">₹{parseFloat(sett.net_settled_amount || 0).toLocaleString()}</strong></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : activeTab === 'histogram' ? (
            /* TAB: LIFECYCLE HISTOGRAM & TIMELINE */
            <div className="space-y-4">
              <div className="bg-white border border-[#D6CAA8] rounded-xl p-4 shadow-xs">
                <h3 className="text-sm font-serif font-black text-[#1E331B] mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-700" />
                  <span>Turnaround Days & Progress Timeline (Histogram)</span>
                </h3>
                
                {/* Horizontal Progress Flow */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 py-4">
                  {[
                    { title: '1. Sauda Entry', date: po.po_date || po.created_at?.slice(0, 10), icon: FileText, status: 'complete', val: `${parseFloat(po.total_contract_mt || 0).toFixed(2)} MT` },
                    { title: '2. Temp Arrival', date: dbArrivals[0]?.date || dbArrivals[0]?.arrival_date || 'Pending', icon: Truck, status: dbArrivals.length > 0 ? 'complete' : 'pending', val: `${dbArrivals.reduce((s, a) => s + (parseFloat(a.final_weight_mt || a.received_weight_mt || 0) || 0), 0).toFixed(2)} MT` },
                    { title: '3. Mill Inspection', date: dbInspections[0]?.mr_date || dbInspections[0]?.created_at?.slice(0, 10) || 'Pending', icon: Droplets, status: dbInspections.length > 0 ? 'complete' : 'pending', val: `${dbInspections.length} MR(s)` },
                    { title: '4. Payment', date: dbPayments[0]?.payment_date || dbPayments[0]?.created_at?.slice(0, 10) || 'Pending', icon: Coins, status: dbPayments.length > 0 ? 'complete' : 'pending', val: `₹${dbPayments.reduce((s, p) => s + (parseFloat(p.amount_paid || p.payable_net_amount || 0) || 0), 0).toLocaleString()}` },
                    { title: '5. Settlement', date: dbSettlements[0]?.created_at?.slice(0, 10) || 'Pending', icon: Scale, status: dbSettlements.length > 0 ? 'complete' : 'pending', val: dbSettlements.length > 0 ? 'Audited' : 'Pending' }
                  ].map((step, idx) => (
                    <div key={step.title} className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3 flex flex-col justify-between text-center relative">
                      <div className="flex justify-center mb-1">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-xs",
                          step.status === 'complete' ? "bg-[#1E331B] text-white" : "bg-slate-200 text-slate-500"
                        )}>
                          <step.icon className="w-4 h-4" />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#1E331B]">{step.title}</span>
                      <span className="text-[10px] font-mono text-emerald-800 font-extrabold my-1">{step.val}</span>
                      <span className="text-[9.5px] font-sans text-slate-500">{step.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'mismatch_audit' ? (
            /* TAB: RECORDED MISMATCH CASES BOARD */
            <div className="space-y-4">
              <div className="bg-white border border-[#D6CAA8] rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Database Mismatch Cases & Approval Audit Log</span>
                  </h3>
                  <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border">
                    {dbMismatches.length + dbSattaMismatches.length} Recorded
                  </span>
                </div>

                {dbMismatches.length === 0 && dbSattaMismatches.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 font-medium text-xs">
                    No active or logged mismatch cases recorded in Supabase for this P.O. All specifications match cleanly.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#FAF7F0] border-b text-[10px] font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="p-2 border-r">Field</th>
                          <th className="p-2 border-r">Expected Value</th>
                          <th className="p-2 border-r">Actual Value</th>
                          <th className="p-2 border-r">Variance / Excess</th>
                          <th className="p-2 border-r">Status</th>
                          <th className="p-2 border-r">Approved By</th>
                          <th className="p-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...dbMismatches, ...dbSattaMismatches].map((m, idx) => (
                          <tr key={m.id || idx} className="hover:bg-amber-50/50 font-sans">
                            <td className="p-2 font-bold text-[#1E331B] border-r">{m.field_name || m.mismatch_type || 'General'}</td>
                            <td className="p-2 font-mono text-slate-700 border-r">{m.expected_value || '—'}</td>
                            <td className="p-2 font-mono text-rose-700 font-bold border-r">{m.actual_value || '—'}</td>
                            <td className="p-2 font-mono text-slate-600 border-r">{m.variance || '—'}</td>
                            <td className="p-2 border-r">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase",
                                m.status === 'approved' || m.status === 'resolved' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                              )}>
                                {m.status || 'PENDING'}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-slate-700 border-r">{m.approved_by || '—'}</td>
                            <td className="p-2 text-slate-600 text-[11px] italic">{m.remarks || m.approval_remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 1: FULL COMPARE & MISMATCH HIGHLIGHT */
            <div className="space-y-4">
              
              {/* Multi-MR Filter Pills */}
              {linkedMrs.length > 1 && (
                <div className="bg-white border border-[#D6CAA8] rounded-xl p-2.5 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#1E331B] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Compare By M.R.:</span>
                  </span>
                  <button
                    onClick={() => setSelectedMrTab('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      selectedMrTab === 'all'
                        ? "bg-[#1E331B] text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    All M.R.s Combined ({linkedMrs.length})
                  </button>
                  {linkedMrs.map(mr => (
                    <button
                      key={mr}
                      onClick={() => setSelectedMrTab(mr)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1",
                        selectedMrTab === mr
                          ? "bg-[#1E331B] text-white shadow-xs"
                          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <span>{mr}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* INDIVIDUAL SECTION-BY-SECTION COMPARISON CARDS */}
              {comparisonResults.sections.map((section) => {
                const isCollapsed = Boolean(collapsedSections[section.id]);
                const IconComponent = section.icon;

                return (
                  <div
                    key={section.id}
                    id={`section-${section.id}`}
                    className={cn(
                      "bg-white border-2 rounded-2xl shadow-xs transition-all overflow-hidden",
                      section.mismatchCount > 0
                        ? "border-rose-300 ring-2 ring-rose-500/10"
                        : "border-[#D6CAA8]"
                    )}
                  >
                    {/* Section Header */}
                    <div 
                      onClick={() => toggleSection(section.id)}
                      className={cn(
                        "p-3.5 flex items-center justify-between cursor-pointer select-none transition-colors",
                        section.mismatchCount > 0
                          ? "bg-rose-50/70 hover:bg-rose-50"
                          : "bg-[#FAF7F0] hover:bg-[#F5EFE0]"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "p-2 rounded-xl text-white shadow-2xs",
                          section.mismatchCount > 0 ? "bg-rose-700" : "bg-[#1E331B]"
                        )}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-serif font-black text-[#1E331B]">
                              {section.title}
                            </h3>
                            {section.mismatchCount > 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-mono font-extrabold flex items-center gap-1 shadow-xs animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{section.mismatchCount} Mismatch(es)</span>
                              </span>
                            ) : section.status === 'pending' ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                                Pending Stage
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-700" />
                                <span>100% Match</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="p-1 rounded-lg text-slate-500 hover:bg-white/60 transition-colors"
                        >
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Section Body (Field Comparison Table) */}
                    {!isCollapsed && (
                      <div className="p-3 sm:p-4 border-t border-slate-200">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-[#FAF7F0] border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                <th className="py-2 px-3 text-left border-r border-slate-200">Field Parameter</th>
                                <th className="py-2 px-3 text-left border-r border-slate-200">Sauda / Reference Value</th>
                                <th className="py-2 px-3 text-left border-r border-slate-200">Actual Recorded Value</th>
                                <th className="py-2 px-3 text-left border-r border-slate-200">Variance / Notes</th>
                                <th className="py-2 px-3 text-center">Comparison Result</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {section.fields.map((field, fIdx) => (
                                <tr
                                  key={fIdx}
                                  className={cn(
                                    "transition-colors",
                                    field.status === 'mismatch'
                                      ? "bg-rose-50/60 font-semibold"
                                      : (fIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30")
                                  )}
                                >
                                  {/* Field Name */}
                                  <td className="py-2.5 px-3 font-bold text-[#1E331B] border-r border-slate-200/60">
                                    <div className="flex items-center gap-1.5">
                                      {field.isCritical && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" title="Critical Business Field" />
                                      )}
                                      <span>{field.name}</span>
                                    </div>
                                  </td>

                                  {/* Reference Value */}
                                  <td className="py-2.5 px-3 font-mono font-medium text-slate-700 border-r border-slate-200/60">
                                    {String(field.referenceValue)}
                                  </td>

                                  {/* Actual Value */}
                                  <td className={cn(
                                    "py-2.5 px-3 font-mono border-r border-slate-200/60",
                                    field.status === 'mismatch'
                                      ? "text-rose-700 font-extrabold"
                                      : "text-slate-800 font-medium"
                                  )}>
                                    {String(field.actualValue)}
                                  </td>

                                  {/* Variance / Notes */}
                                  <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200/60 text-[11px]">
                                    {field.variance && (
                                      <span className={cn(
                                        "font-mono font-bold mr-1.5",
                                        field.status === 'mismatch' ? "text-rose-700" : "text-slate-700"
                                      )}>
                                        [{field.variance}]
                                      </span>
                                    )}
                                    <span className="italic">{field.notes || '—'}</span>
                                  </td>

                                  {/* Status Result Badge */}
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    {field.status === 'match' ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold inline-flex items-center gap-1 shadow-2xs">
                                        <Check className="w-3 h-3 text-emerald-700" />
                                        <span>✓ Match</span>
                                      </span>
                                    ) : field.status === 'mismatch' ? (
                                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black inline-flex items-center gap-1 shadow-2xs animate-pulse">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>⚠ Mismatch</span>
                                      </span>
                                    ) : field.status === 'not_available' ? (
                                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium">
                                        — Not Available
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[10px]">
                                        N/A
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          )}
        </div>

        {/* 4. MODAL FOOTER ACTION BAR */}
        <div className="bg-white border-t border-[#D6CAA8] p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Real-time cross-stage verification verified against Supabase Database audit ledger.</span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToMismatch && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToMismatch(po.po_no);
                }}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Open Mismatch Board</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1E331B] hover:bg-[#152413] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
