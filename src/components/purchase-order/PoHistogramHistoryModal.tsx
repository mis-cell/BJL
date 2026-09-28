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
  Percent
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
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
  const [activeTab, setActiveTab] = useState<'compare' | 'histogram' | 'mismatch_audit' | 'all_stages'>('compare');
  const [selectedMrTab, setSelectedMrTab] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Fetched Live Linked Database Data
  const [dbPoDetails, setDbPoDetails] = useState<any[]>([]);
  const [dbArrivals, setDbArrivals] = useState<any[]>([]);
  const [dbInspections, setDbInspections] = useState<any[]>([]);
  const [dbPayments, setDbPayments] = useState<any[]>([]);
  const [dbSettlements, setDbSettlements] = useState<any[]>([]);
  const [dbMismatches, setDbMismatches] = useState<any[]>([]);
  const [dbSattaRate, setDbSattaRate] = useState<any | null>(null);

  // Load all linked records for this PO
  useEffect(() => {
    if (!isOpen || !po) return;

    let isMounted = true;
    const fetchLinkedHistoryData = async () => {
      setLoading(true);
      const poNo = String(po.po_no || '').trim();
      const ptfNo = String(po.ptf_no || '').trim();

      try {
        if (!supabase) {
          setLoading(false);
          return;
        }

        // 1. Fetch PO Details
        const { data: poDetails } = await supabase
          .from('sauda_check_point_details')
          .select('*')
          .eq('po_no', poNo);

        // 2. Fetch Arrivals (amad_register)
        const { data: arrivals } = await supabase
          .from('amad_register')
          .select('*')
          .or(`po_no.eq.${poNo},ptf_no.eq.${poNo}${ptfNo ? `,ptf_no.eq.${ptfNo}` : ''}`);

        // 3. Fetch Material Inspections
        const { data: inspections } = await supabase
          .from('material_inspection')
          .select('*, material_inspection_details(*)')
          .or(`po_no.eq.${poNo},ptf_no.eq.${poNo}`);

        // 4. Fetch Payments
        const { data: payments } = await supabase
          .from('payment_details')
          .select('*, payment_master(*)')
          .or(`po_no.eq.${poNo},ptf_no.eq.${poNo}`);

        // 5. Fetch Settlements
        const { data: settlements } = await supabase
          .from('mr_settlement_master')
          .select('*')
          .or(`po_no.eq.${poNo},ptf_no.eq.${poNo}`);

        // 6. Fetch Recorded Mismatch Cases
        const { data: mismatches } = await supabase
          .from('mismatch_cases')
          .select('*')
          .or(`po_no.eq.${poNo},ptf_no.eq.${poNo}`);

        // 7. Fetch Satta Rate on Sauda Date for Area & Grade
        const saudaDate = po.po_date || po.created_at?.slice(0, 10);
        let sattaLimit: any = null;
        if (saudaDate) {
          const { data: sRates } = await supabase
            .from('satta_master')
            .select('*')
            .eq('entry_date', saudaDate)
            .limit(1);
          if (sRates && sRates.length > 0) {
            sattaLimit = sRates[0];
          }
        }

        if (isMounted) {
          setDbPoDetails(poDetails || []);
          setDbArrivals(arrivals || allArrivals.filter((a: any) => a.po_no === poNo || a.ptf_no === poNo));
          setDbInspections(inspections || allInspections.filter((i: any) => i.po_no === poNo));
          setDbPayments(payments || allPayments.filter((p: any) => p.po_no === poNo));
          setDbSettlements(settlements || allSettlements.filter((s: any) => s.po_no === poNo));
          setDbMismatches(mismatches || []);
          setDbSattaRate(sattaLimit);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching PO Histogram comparison data:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchLinkedHistoryData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, po]);

  // Derived Multi-MR list
  const linkedMrs = useMemo(() => {
    const mrSet = new Set<string>();
    dbArrivals.forEach((a: any) => {
      const mr = a.mr_no || a.mr_number || a.amad_no;
      if (mr) mrSet.add(String(mr).trim());
    });
    dbInspections.forEach((i: any) => {
      const mr = i.mr_no || i.mr_number;
      if (mr) mrSet.add(String(mr).trim());
    });
    dbSettlements.forEach((s: any) => {
      const mr = s.mr_no || s.mr_number;
      if (mr) mrSet.add(String(mr).trim());
    });
    return Array.from(mrSet);
  }, [dbArrivals, dbInspections, dbSettlements]);

  // Comprehensive Comparison Logic
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
    const totalArrivalWeight = dbArrivals.reduce((sum, a) => sum + (parseFloat(a.received_weight_mt || a.net_weight || a.weight || 0) || 0), 0);
    const totalArrivalUnits = dbArrivals.reduce((sum, a) => sum + (parseInt(a.received_units || a.units || a.quantity || 0, 10) || 0), 0);
    const firstArrival = dbArrivals[0] || {};
    const arrivalLorryNos = dbArrivals.map(a => a.lorry_no || a.truck_no || a.vehicle_no).filter(Boolean).join(', ');

    // Tolerance Calculation
    const weightTol = calculateWeightTolerance(poContractMt, totalArrivalWeight);

    // Satta Rate Reference
    const sattaBaseRate = dbSattaRate?.base_rate ? Number(dbSattaRate.base_rate) : null;

    // Aggregate Inspection metrics
    const avgMoisture = dbInspections.length > 0
      ? (dbInspections.reduce((sum, i) => sum + (parseFloat(i.moisture_percent || i.moisture || 0) || 0), 0) / dbInspections.length)
      : 0;
    const avgDust = dbInspections.length > 0
      ? (dbInspections.reduce((sum, i) => sum + (parseFloat(i.dust_percent || i.dust || 0) || 0), 0) / dbInspections.length)
      : 0;
    const avgNcv = dbInspections.length > 0
      ? (dbInspections.reduce((sum, i) => sum + (parseFloat(i.ncv_percent || i.ncv || 0) || 0), 0) / dbInspections.length)
      : 0;
    const totalPremiumSum = dbInspections.reduce((sum, i) => sum + (parseFloat(i.premium_amount || i.premium_total || 0) || 0), 0);

    // Aggregate Payment metrics
    const totalPaidAmount = dbPayments.reduce((sum, p) => sum + (parseFloat(p.amount_paid || p.paid_amount || p.amount || 0) || 0), 0);
    const contractValueEst = poContractMt > 0 && poRate > 0 ? (poContractMt * 10 * poRate) : 0; // 1 MT = 10 Qtl

    // Aggregate Settlement metrics
    const settledWeight = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.settled_weight_mt || s.settled_weight || 0) || 0), 0);
    const settledPenalty = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.penalty_amount || s.excess_short_penalty || 0) || 0), 0);
    const settledQualityDeductions = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.total_deduction_amount || s.quality_claim_amount || 0) || 0), 0);
    const totalSettledPayable = dbSettlements.reduce((sum, s) => sum + (parseFloat(s.net_settled_amount || s.final_amount || 0) || 0), 0);

    // -------------------------------------------------------------
    // SECTION 1: SAUDA CHECK POINT (Base Reference)
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
        name: 'Contract Weight (MT)',
        referenceValue: `${poContractMt.toFixed(3)} MT`,
        actualValue: `${poContractMt.toFixed(3)} MT`,
        status: 'match'
      },
      {
        name: 'Contract Lorries',
        referenceValue: `${poLorries} Lorry`,
        actualValue: `${poLorries} Lorry`,
        status: 'match'
      },
      {
        name: 'Sauda Rate / Qtl',
        referenceValue: poRate > 0 ? `₹${poRate.toLocaleString()}` : 'N/A',
        actualValue: poRate > 0 ? `₹${poRate.toLocaleString()}` : 'N/A',
        status: 'match'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 2: TEMPORARY ARRIVAL
    // -------------------------------------------------------------
    const tempArrivalFields: ComparisonField[] = [
      {
        name: 'Challan Supplier',
        referenceValue: poSupplier || 'DIRECT',
        actualValue: firstArrival.challan_supplier || firstArrival.supplier || (dbArrivals.length > 0 ? 'Recorded' : 'Not Arrived'),
        status: dbArrivals.length === 0 ? 'not_available' : (
          String(firstArrival.challan_supplier || firstArrival.supplier || '').trim().toUpperCase() === poSupplier.toUpperCase() || !firstArrival.challan_supplier
            ? 'match'
            : 'mismatch'
        ),
        notes: firstArrival.challan_supplier ? undefined : 'No separate challan supplier specified',
        isCritical: true
      },
      {
        name: 'Arrival Station / Area',
        referenceValue: poArea || 'N/A',
        actualValue: firstArrival.area || firstArrival.station || (dbArrivals.length > 0 ? 'Recorded' : 'Not Arrived'),
        status: dbArrivals.length === 0 ? 'not_available' : (
          !firstArrival.area || String(firstArrival.area).trim().toUpperCase() === poArea.toUpperCase()
            ? 'match'
            : 'mismatch'
        )
      },
      {
        name: 'Arrival Grade',
        referenceValue: poGrade || 'N/A',
        actualValue: firstArrival.grade || firstArrival.item_grade || (dbArrivals.length > 0 ? 'Recorded' : 'Not Arrived'),
        status: dbArrivals.length === 0 ? 'not_available' : (
          !firstArrival.grade || String(firstArrival.grade).trim().toUpperCase() === poGrade.toUpperCase()
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
        name: 'Received vs Contract Weight',
        referenceValue: `${poContractMt.toFixed(3)} MT`,
        actualValue: `${totalArrivalWeight.toFixed(3)} MT`,
        variance: weightTol.diffMt !== 0 ? `${weightTol.diffMt >= 0 ? '+' : ''}${weightTol.diffMt.toFixed(3)} MT` : '0.000 MT',
        status: dbArrivals.length === 0 ? 'not_available' : (
          weightTol.isTolerable ? 'match' : 'mismatch'
        ),
        notes: weightTol.isTolerable 
          ? `Within allowed tolerance (±${weightTol.toleranceMt.toFixed(3)} MT)`
          : `Beyond allowed tolerance of ±${weightTol.toleranceMt.toFixed(3)} MT (Penalty applicable)`,
        isCritical: true
      },
      {
        name: 'Arrival Delivery Timeline',
        referenceValue: poDeliveryDays > 0 ? `${poDeliveryDays} Days Window` : 'Immediate',
        actualValue: firstArrival.arrival_date ? `Arrived on ${firstArrival.arrival_date}` : (dbArrivals.length > 0 ? 'Recorded' : 'Pending'),
        status: dbArrivals.length === 0 ? 'not_available' : 'match'
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
        actualValue: dbInspections.length > 0 ? (dbInspections[0].actual_grade || poGrade) : 'Pending Inspection',
        status: dbInspections.length === 0 ? 'not_available' : (
          !dbInspections[0].actual_grade || String(dbInspections[0].actual_grade).trim().toUpperCase() === poGrade.toUpperCase()
            ? 'match'
            : 'mismatch'
        ),
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
        name: 'Premium / Incentive Lots',
        referenceValue: 'Standard Rate',
        actualValue: totalPremiumSum > 0 ? `₹${totalPremiumSum.toLocaleString()} Premium` : 'Nil Premium',
        status: 'match',
        notes: totalPremiumSum > 0 ? 'High-quality lots awarded positive incentive' : 'Standard quality delivered'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 4: SAUDA PRICE MISMATCH
    // -------------------------------------------------------------
    const priceMismatches = dbMismatches.filter(m => m.mismatch_type === 'price' || m.field_name?.toLowerCase().includes('rate') || m.field_name?.toLowerCase().includes('price'));
    const rateDiff = sattaBaseRate !== null ? (poRate - sattaBaseRate) : 0;
    const isRateBeyondLimit = sattaBaseRate !== null && poRate > sattaBaseRate;

    const saudaPriceFields: ComparisonField[] = [
      {
        name: 'Sauda Rate vs Satta Rate',
        referenceValue: sattaBaseRate !== null ? `₹${sattaBaseRate.toLocaleString()} / Qtl (Satta)` : 'Reference Rate',
        actualValue: `₹${poRate.toLocaleString()} / Qtl (Sauda)`,
        variance: sattaBaseRate !== null ? (rateDiff !== 0 ? `${rateDiff >= 0 ? '+' : ''}₹${rateDiff}/Qtl` : '₹0') : 'N/A',
        status: sattaBaseRate === null ? 'match' : (
          isRateBeyondLimit ? 'mismatch' : 'match'
        ),
        notes: isRateBeyondLimit ? 'Sauda Rate exceeds published Satta baseline limit.' : 'Rate within Satta ceiling boundary.',
        isCritical: true
      },
      {
        name: 'Management Price Approval',
        referenceValue: 'Required if Above Satta',
        actualValue: priceMismatches.length > 0 
          ? (priceMismatches[0].status === 'approved' ? 'Approved by Admin' : 'Pending Price Approval')
          : (isRateBeyondLimit ? 'Approval Required' : 'Auto Approved'),
        status: isRateBeyondLimit 
          ? (priceMismatches.some(m => m.status === 'approved') ? 'match' : 'mismatch')
          : 'match',
        notes: priceMismatches[0]?.approved_by ? `Approved by: ${priceMismatches[0].approved_by}` : undefined,
        isCritical: isRateBeyondLimit
      }
    ];

    // -------------------------------------------------------------
    // SECTION 5: MATERIAL MISMATCH BOARD
    // -------------------------------------------------------------
    const materialMismatches = dbMismatches.filter(m => m.mismatch_type === 'material' || m.mismatch_type === 'quality' || !m.mismatch_type);
    const unapprovedMaterialMismatches = materialMismatches.filter(m => m.status !== 'approved' && m.status !== 'resolved');

    const materialMismatchFields: ComparisonField[] = [
      {
        name: 'Recorded Material Discrepancies',
        referenceValue: 'Zero Discrepancies',
        actualValue: materialMismatches.length > 0 ? `${materialMismatches.length} Case(s) Logged` : '0 Cases',
        status: unapprovedMaterialMismatches.length > 0 ? 'mismatch' : 'match',
        notes: unapprovedMaterialMismatches.length > 0 
          ? `${unapprovedMaterialMismatches.length} unapproved discrepancy awaiting signoff` 
          : 'All material parameters clear or approved',
        isCritical: unapprovedMaterialMismatches.length > 0
      },
      {
        name: 'Material Resolution Status',
        referenceValue: '100% Cleared',
        actualValue: materialMismatches.length === 0 
          ? 'Clear' 
          : (unapprovedMaterialMismatches.length === 0 ? 'All Resolved' : 'Action Required'),
        status: unapprovedMaterialMismatches.length > 0 ? 'mismatch' : 'match'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 6: PAYMENT
    // -------------------------------------------------------------
    const paymentFields: ComparisonField[] = [
      {
        name: 'Advance Payment Status',
        referenceValue: 'Expected on Arrival',
        actualValue: totalPaidAmount > 0 ? `₹${totalPaidAmount.toLocaleString()} Paid` : 'Nil Payment',
        status: totalPaidAmount > 0 ? 'match' : (dbArrivals.length > 0 ? 'mismatch' : 'not_available'),
        notes: dbPayments.length > 0 ? `${dbPayments.length} Payment Voucher(s) recorded` : 'No voucher generated yet',
        isCritical: dbArrivals.length > 0 && totalPaidAmount === 0
      },
      {
        name: 'Payment vs Contract Value',
        referenceValue: contractValueEst > 0 ? `₹${contractValueEst.toLocaleString()} (Est)` : 'N/A',
        actualValue: `₹${totalPaidAmount.toLocaleString()} Disbursed`,
        status: totalPaidAmount <= (contractValueEst * 1.1) ? 'match' : 'mismatch',
        notes: totalPaidAmount > contractValueEst ? 'Payment disbursed exceeds original contract estimated value' : 'Payment within authorization limits'
      }
    ];

    // -------------------------------------------------------------
    // SECTION 7: SETTLEMENT
    // -------------------------------------------------------------
    const settlementFields: ComparisonField[] = [
      {
        name: 'Final Settled Weight',
        referenceValue: `${poContractMt.toFixed(3)} MT`,
        actualValue: settledWeight > 0 ? `${settledWeight.toFixed(3)} MT` : (dbSettlements.length > 0 ? 'Settled' : 'Pending Settlement'),
        status: dbSettlements.length === 0 ? 'not_available' : (
          Math.abs(settledWeight - totalArrivalWeight) <= 0.05 ? 'match' : 'mismatch'
        ),
        notes: dbSettlements.length > 0 ? 'Audited against final weighbridge slip' : 'Account settlement not generated yet'
      },
      {
        name: 'Weight Penalty Applied',
        referenceValue: weightTol.isTolerable ? '₹0 (Tolerable)' : 'Penalty Mandated',
        actualValue: settledPenalty > 0 ? `₹${settledPenalty.toLocaleString()}` : '₹0',
        status: (!weightTol.isTolerable && dbSettlements.length > 0 && settledPenalty === 0) ? 'mismatch' : 'match',
        notes: weightTol.penaltyAmount > 0 ? `Expected TD5 Difference penalty: ₹${weightTol.penaltyAmount.toLocaleString()}` : 'No weight penalty applicable'
      },
      {
        name: 'Quality Claim Deductions',
        referenceValue: avgMoisture > 15 || avgDust > 1 ? 'Deduction Applicable' : 'Nil Deduction',
        actualValue: settledQualityDeductions > 0 ? `₹${settledQualityDeductions.toLocaleString()}` : '₹0',
        status: (avgMoisture > 15 && dbSettlements.length > 0 && settledQualityDeductions === 0) ? 'mismatch' : 'match',
        notes: settledQualityDeductions > 0 ? 'Moisture / Grade Down / Dust claim adjusted' : 'No quality deductions recorded'
      },
      {
        name: 'Final Settlement Voucher Status',
        referenceValue: 'Settled & Closed',
        actualValue: dbSettlements.length > 0 ? (dbSettlements[0].status || 'COMPLETED') : 'Pending Final Audit',
        status: dbSettlements.length > 0 ? 'match' : (dbArrivals.length > 0 ? 'pending' : 'not_available')
      }
    ];

    // Build Section Object Array
    const sections: SectionComparison[] = [
      {
        id: 'sauda_check_point',
        title: 'Sauda Check Point',
        icon: FileText,
        fields: saudaFields,
        mismatchCount: saudaFields.filter(f => f.status === 'mismatch').length,
        status: saudaFields.some(f => f.status === 'mismatch') ? 'mismatch' : 'clean'
      },
      {
        id: 'temporary_arrival',
        title: 'Temporary Arrival',
        icon: Truck,
        fields: tempArrivalFields,
        mismatchCount: tempArrivalFields.filter(f => f.status === 'mismatch').length,
        status: tempArrivalFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbArrivals.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbArrivals
      },
      {
        id: 'mill_inspection',
        title: 'Mill Inspection',
        icon: Droplets,
        fields: millInspFields,
        mismatchCount: millInspFields.filter(f => f.status === 'mismatch').length,
        status: millInspFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbInspections.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbInspections
      },
      {
        id: 'sauda_price_mismatch',
        title: 'Sauda Price Mismatch',
        icon: Coins,
        fields: saudaPriceFields,
        mismatchCount: saudaPriceFields.filter(f => f.status === 'mismatch').length,
        status: saudaPriceFields.some(f => f.status === 'mismatch') ? 'mismatch' : 'clean',
        existingRecords: priceMismatches
      },
      {
        id: 'material_mismatch',
        title: 'Material Mismatch Board',
        icon: Layers,
        fields: materialMismatchFields,
        mismatchCount: materialMismatchFields.filter(f => f.status === 'mismatch').length,
        status: materialMismatchFields.some(f => f.status === 'mismatch') ? 'mismatch' : 'clean',
        existingRecords: materialMismatches
      },
      {
        id: 'payment',
        title: 'Payment Operations',
        icon: Coins,
        fields: paymentFields,
        mismatchCount: paymentFields.filter(f => f.status === 'mismatch').length,
        status: paymentFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbPayments.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbPayments
      },
      {
        id: 'settlement',
        title: 'Settlement & Final Audit',
        icon: Scale,
        fields: settlementFields,
        mismatchCount: settlementFields.filter(f => f.status === 'mismatch').length,
        status: settlementFields.some(f => f.status === 'mismatch') ? 'mismatch' : (dbSettlements.length === 0 ? 'pending' : 'clean'),
        existingRecords: dbSettlements
      }
    ];

    // Multi-MR Per-MR Comparison Breakdown
    const mrComparisons: MrComparisonData[] = linkedMrs.map(mrNo => {
      const arr = dbArrivals.find(a => (a.mr_no || a.mr_number || a.amad_no) === mrNo) || {};
      const insp = dbInspections.find(i => (i.mr_no || i.mr_number) === mrNo) || {};
      const sett = dbSettlements.find(s => (s.mr_no || s.mr_number) === mrNo) || {};

      const arrSupplier = arr.challan_supplier || arr.supplier || '';
      const arrGrade = arr.grade || arr.item_grade || '';
      const arrWt = parseFloat(arr.received_weight_mt || arr.net_weight || 0) || 0;
      const inspMoisture = parseFloat(insp.moisture_percent || insp.moisture || 0) || 0;
      const inspDust = parseFloat(insp.dust_percent || insp.dust || 0) || 0;
      const inspNcv = parseFloat(insp.ncv_percent || insp.ncv || 0) || 0;

      const mrTempArrivalFields: ComparisonField[] = [
        {
          name: 'Supplier',
          referenceValue: poSupplier || 'DIRECT',
          actualValue: arrSupplier || 'Direct Match',
          status: !arrSupplier || arrSupplier.toUpperCase() === poSupplier.toUpperCase() ? 'match' : 'mismatch'
        },
        {
          name: 'Grade',
          referenceValue: poGrade,
          actualValue: arrGrade || poGrade,
          status: !arrGrade || arrGrade.toUpperCase() === poGrade.toUpperCase() ? 'match' : 'mismatch'
        },
        {
          name: 'Lorry No',
          referenceValue: 'Expected Lorry',
          actualValue: arr.lorry_no || arr.truck_no || 'Recorded',
          status: 'match'
        },
        {
          name: 'Received Weight (MT)',
          referenceValue: poLorries > 0 ? `~${(poContractMt / poLorries).toFixed(3)} MT/Lorry` : `${poContractMt.toFixed(3)} MT`,
          actualValue: `${arrWt.toFixed(3)} MT`,
          status: 'match'
        }
      ];

      const mrMillInspFields: ComparisonField[] = [
        {
          name: 'Moisture (%)',
          referenceValue: '≤ 15.0%',
          actualValue: `${inspMoisture.toFixed(1)}%`,
          status: inspMoisture <= 15.0 ? 'match' : 'mismatch'
        },
        {
          name: 'Dust (%)',
          referenceValue: '≤ 1.0%',
          actualValue: `${inspDust.toFixed(1)}%`,
          status: inspDust <= 1.0 ? 'match' : 'mismatch'
        },
        {
          name: 'NCV (%)',
          referenceValue: '≤ 0.5%',
          actualValue: `${inspNcv.toFixed(1)}%`,
          status: inspNcv <= 0.5 ? 'match' : 'mismatch'
        }
      ];

      const mrMismatchCount = mrTempArrivalFields.filter(f => f.status === 'mismatch').length +
                              mrMillInspFields.filter(f => f.status === 'mismatch').length;

      return {
        mrNo,
        arrivalRecord: arr,
        inspectionRecord: insp,
        settlementRecord: sett,
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
  }, [po, dbArrivals, dbInspections, dbPayments, dbSettlements, dbMismatches, dbSattaRate, linkedMrs]);

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
                Full-spectrum cross-stage data comparison & instant mismatch highlight
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
                onClick={() => setActiveTab('histogram')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  activeTab === 'histogram' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-100 hover:text-white"
                )}
              >
                Lifecycle Histogram
              </button>
              <button
                onClick={() => setActiveTab('mismatch_audit')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  activeTab === 'mismatch_audit' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-100 hover:text-white"
                )}
              >
                Mismatch Board ({dbMismatches.length})
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

        {/* 2. TOP MISMATCH SUMMARY STRIP & FAST JUMP INDICATORS */}
        <div className="bg-white border-b border-[#D6CAA8] p-3 sm:p-4 shadow-2xs shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Summary Stat Cards */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className={cn(
                "px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold",
                comparisonResults.summary.totalMismatches > 0
                  ? "bg-rose-50 border-rose-300 text-rose-900"
                  : "bg-emerald-50 border-emerald-300 text-emerald-900"
              )}>
                {comparisonResults.summary.totalMismatches > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                <span>
                  {comparisonResults.summary.totalMismatches > 0
                    ? `⚠ ${comparisonResults.summary.totalMismatches} Mismatch(es) Found Across ${comparisonResults.summary.mismatchSections} Section(s)`
                    : '✓ All Compared Stages Match Cleanly'}
                </span>
              </div>

              <div className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2">
                <span>Linked M.R.s: <strong className="text-slate-900">{linkedMrs.length}</strong></span>
                <span>•</span>
                <span>Payments: <strong className="text-slate-900">{dbPayments.length}</strong></span>
                <span>•</span>
                <span>Settlement: <strong className="text-slate-900">{dbSettlements.length > 0 ? 'Generated' : 'Pending'}</strong></span>
              </div>
            </div>

            {/* Quick Section Jump Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">Quick Jump:</span>
              {comparisonResults.sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1",
                    sec.mismatchCount > 0
                      ? "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                      : sec.status === 'pending'
                        ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  )}
                  title={`Click to jump to ${sec.title}`}
                >
                  {sec.mismatchCount > 0 ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
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

          {/* Mismatch Areas Ribbon */}
          {comparisonResults.summary.totalMismatches > 0 && (
            <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-[10px] font-bold uppercase text-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Mismatch Areas:</span>
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
              <p className="font-bold text-sm">Cross-comparing all 7 lifecycle stages...</p>
              <p className="text-xs text-slate-400">Comparing Sauda Check Point, Temporary Arrival, Mill Inspection, Payments, and Settlement</p>
            </div>
          ) : activeTab === 'histogram' ? (
            /* TAB 2: LIFECYCLE HISTOGRAM & TIMELINE */
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
                    { title: '2. Temp Arrival', date: dbArrivals[0]?.arrival_date || 'Pending', icon: Truck, status: dbArrivals.length > 0 ? 'complete' : 'pending', val: `${dbArrivals.reduce((s, a) => s + (parseFloat(a.received_weight_mt || 0) || 0), 0).toFixed(2)} MT` },
                    { title: '3. Mill Inspection', date: dbInspections[0]?.created_at?.slice(0, 10) || 'Pending', icon: Droplets, status: dbInspections.length > 0 ? 'complete' : 'pending', val: `${dbInspections.length} MR(s)` },
                    { title: '4. Payment', date: dbPayments[0]?.created_at?.slice(0, 10) || 'Pending', icon: Coins, status: dbPayments.length > 0 ? 'complete' : 'pending', val: `₹${dbPayments.reduce((s, p) => s + (parseFloat(p.amount_paid || 0) || 0), 0).toLocaleString()}` },
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
            /* TAB 3: RECORDED MISMATCH CASES BOARD */
            <div className="space-y-4">
              <div className="bg-white border border-[#D6CAA8] rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-serif font-black text-[#1E331B] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Database Mismatch Cases & Approval Audit Log</span>
                  </h3>
                  <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border">
                    {dbMismatches.length} Recorded
                  </span>
                </div>

                {dbMismatches.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 font-medium text-xs">
                    No active or logged mismatch cases recorded in Supabase for this P.O.
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
                        {dbMismatches.map((m, idx) => (
                          <tr key={m.id || idx} className="hover:bg-amber-50/50 font-sans">
                            <td className="p-2 font-bold text-[#1E331B] border-r">{m.field_name || m.mismatch_type || 'General'}</td>
                            <td className="p-2 font-mono text-slate-700 border-r">{m.expected_value || '—'}</td>
                            <td className="p-2 font-mono text-rose-700 font-bold border-r">{m.actual_value || '—'}</td>
                            <td className="p-2 font-mono text-slate-600 border-r">{m.variance || '—'}</td>
                            <td className="p-2 border-r">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase",
                                m.status === 'approved' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
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
              
              {/* Multi-MR Filter Pills (if more than 1 MR exists) */}
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
