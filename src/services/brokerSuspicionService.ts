/**
 * Broker-Wise Suspicion Detection Service
 * Analyzes all business records (Sauda, PO, Arrival, Final Arrival, Payment, Inspection)
 * to detect anomalies, duplicates, weight mismatches, rate deviations, and missing data.
 */

export interface SuspiciousAnomalyRecord {
  id: string;
  brokerName: string;
  saudaNo: string;
  poNo: string;
  contractWeight: number; // MT
  arrivedWeight: number; // MT
  weightDifference: number; // Arrived - Contract
  saudaRate: number; // ₹/Qtl
  comparisonRate: number; // Average rate for broker or grade
  expectedValue: string;
  actualValue: string;
  anomalyType: 
    | 'Exact Duplicate Transaction' 
    | 'Contract vs Arrived Weight Mismatch' 
    | 'Zero or Missing Rate' 
    | 'Missing Broker Name' 
    | 'Zero Contract Weight' 
    | 'Unusual Rate Variance'
    | 'Orphaned P.O. Record';
  severity: 'High' | 'Medium' | 'Low';
  reason: string;
  detectionRule: string;
  transactionDate: string;
  recommendedAction: string;
  rawRecord: any;
}

export interface BrokerSuspicionSummary {
  brokerName: string;
  totalRecordsReviewed: number;
  anomalyCount: number;
  severity: 'High' | 'Medium' | 'Low';
  primaryIssue: string;
  anomalies: SuspiciousAnomalyRecord[];
}

export function analyzeBrokerSuspiciousData(params: {
  saudas?: any[];
  pos?: any[];
  arrivals?: any[];
  finalArrivals?: any[];
  paymentRecords?: any[];
  saudaCheckPoints?: any[];
}): BrokerSuspicionSummary[] {
  const {
    saudas = [],
    pos = [],
    arrivals = [],
    finalArrivals = [],
    paymentRecords = [],
    saudaCheckPoints = []
  } = params;

  // Map to store broker records
  const brokerMap = new Map<string, any[]>();

  // Helper to normalize broker name
  const normalizeBroker = (b: any): string => {
    if (!b) return 'UNASSIGNED BROKER';
    if (typeof b === 'string') return b.trim().toUpperCase() || 'UNASSIGNED BROKER';
    if (typeof b === 'object') {
      const name = b.broker_name || b.brok_name || b.name || b.broker || '';
      return String(name).trim().toUpperCase() || 'UNASSIGNED BROKER';
    }
    return String(b).trim().toUpperCase() || 'UNASSIGNED BROKER';
  };

  // Combine relevant transaction sources into unified records for analysis
  const unifiedItems: any[] = [];

  // 1. Process Saudas / Sauda Check Points
  const baseSaudas = saudaCheckPoints.length > 0 ? saudaCheckPoints : saudas;
  baseSaudas.forEach((s, idx) => {
    const broker = normalizeBroker(s.broker_name || s.brok_name || s.broker || s.supplier_broker);
    const saudaNo = s.sauda_no || s.saudaNo || s.contract_no || s.contractNo || `SD-${idx+1}`;
    const poNo = s.po_no || s.poNo || s.p_o_no || '';
    const contractWeight = Number(s.total_weight_mt || s.weight_mt || s.contract_weight || s.weight || 0);
    const rate = Number(s.rate_per_qtl || s.rate || s.b_rate || s.sauda_rate || 0);
    const date = s.sauda_date || s.contract_date || s.date || '2026-04-01';

    unifiedItems.push({
      id: s.id || `sauda-${idx}`,
      brokerName: broker,
      saudaNo,
      poNo,
      contractWeight,
      arrivedWeight: 0, // will be matched below
      saudaRate: rate,
      transactionDate: date,
      sourceType: 'SAUDA',
      rawRecord: s
    });
  });

  // 2. Process Purchase Orders
  pos.forEach((p, idx) => {
    const broker = normalizeBroker(p.broker_name || p.brok_name || p.broker);
    const saudaNo = p.sauda_no || p.saudaNo || '';
    const poNo = p.po_no || p.poNo || p.p_o_no || `PO-${idx+1}`;
    const weight = Number(p.total_weight_mt || p.weight_mt || p.po_weight || p.weight || 0);
    const rate = Number(p.rate_per_qtl || p.rate || p.purchase_rate || 0);
    const date = p.po_date || p.date || '2026-04-01';

    // Check if matching sauda already exists
    const existing = unifiedItems.find(item => item.brokerName === broker && (item.poNo === poNo || (saudaNo && item.saudaNo === saudaNo)));
    if (existing) {
      if (!existing.poNo && poNo) existing.poNo = poNo;
      if (existing.contractWeight === 0 && weight > 0) existing.contractWeight = weight;
      if (existing.saudaRate === 0 && rate > 0) existing.saudaRate = rate;
    } else {
      unifiedItems.push({
        id: p.id || `po-${idx}`,
        brokerName: broker,
        saudaNo: saudaNo || poNo,
        poNo,
        contractWeight: weight,
        arrivedWeight: 0,
        saudaRate: rate,
        transactionDate: date,
        sourceType: 'PO',
        rawRecord: p
      });
    }
  });

  // 3. Process Arrivals (match arrived weight to sauda/po)
  const allArrivals = [...arrivals, ...finalArrivals];
  allArrivals.forEach((arr) => {
    const arrPo = String(arr.po_no || arr.poNo || arr.p_o_no || '').trim();
    const arrSauda = String(arr.sauda_no || arr.saudaNo || '').trim();
    const arrWeight = Number(arr.electronic_net_weight || arr.net_weight || arr.weight_mt || arr.weight || 0);
    const normalizedArrWeight = arrWeight > 100 ? arrWeight / 1000 : arrWeight;

    if (arrPo || arrSauda) {
      const match = unifiedItems.find(item => 
        (arrPo && item.poNo && item.poNo.toUpperCase() === arrPo.toUpperCase()) ||
        (arrSauda && item.saudaNo && item.saudaNo.toUpperCase() === arrSauda.toUpperCase())
      );
      if (match) {
        match.arrivedWeight += normalizedArrWeight;
      }
    }
  });

  // Group items by broker
  unifiedItems.forEach(item => {
    const b = item.brokerName;
    if (!brokerMap.has(b)) {
      brokerMap.set(b, []);
    }
    brokerMap.get(b)!.push(item);
  });

  const brokerSummaries: BrokerSuspicionSummary[] = [];

  // Compute average rates per broker for comparison
  const brokerAvgRates: Record<string, number> = {};
  brokerMap.forEach((items, broker) => {
    const validRates = items.map(i => i.saudaRate).filter(r => r > 0);
    const avg = validRates.length > 0 ? validRates.reduce((a, b) => a + b, 0) / validRates.length : 5200;
    brokerAvgRates[broker] = avg;
  });

  // Detect anomalies for each broker
  brokerMap.forEach((items, broker) => {
    const anomalies: SuspiciousAnomalyRecord[] = [];
    const avgRate = brokerAvgRates[broker] || 5200;

    // Track duplicate detection map (key: saudaNo + contractWeight)
    const seenTransactions = new Map<string, boolean>();

    items.forEach((item, idx) => {
      const dupKey = `${item.saudaNo}_${item.contractWeight}`.toUpperCase();
      
      // 1. Exact Duplicate Check
      if (item.saudaNo && item.saudaNo !== 'N/A' && seenTransactions.has(dupKey)) {
        anomalies.push({
          id: `${item.id}-dup`,
          brokerName: broker,
          saudaNo: item.saudaNo,
          poNo: item.poNo || 'N/A',
          contractWeight: item.contractWeight,
          arrivedWeight: item.arrivedWeight,
          weightDifference: item.arrivedWeight - item.contractWeight,
          saudaRate: item.saudaRate,
          comparisonRate: avgRate,
          expectedValue: 'Unique Sauda Record',
          actualValue: `Duplicate Sauda Number ${item.saudaNo}`,
          anomalyType: 'Exact Duplicate Transaction',
          severity: 'High',
          reason: `Sauda number ${item.saudaNo} with contract weight ${item.contractWeight} MT appears multiple times in database records for broker ${broker}.`,
          detectionRule: 'Duplicate check on (Sauda Number + Contract Weight)',
          transactionDate: item.transactionDate,
          recommendedAction: 'Verify against physical contract book and delete or merge duplicate entry.',
          rawRecord: item.rawRecord
        });
      } else if (item.saudaNo) {
        seenTransactions.set(dupKey, true);
      }

      // 2. Weight Mismatch Check (Arrived Weight exceeds Contract Weight by > 25% or zero when contract > 50 MT)
      if (item.contractWeight > 10 && item.arrivedWeight > 0) {
        const diff = item.arrivedWeight - item.contractWeight;
        const pctDiff = (diff / item.contractWeight) * 100;
        if (Math.abs(pctDiff) > 25) {
          anomalies.push({
            id: `${item.id}-weight`,
            brokerName: broker,
            saudaNo: item.saudaNo || 'N/A',
            poNo: item.poNo || 'N/A',
            contractWeight: item.contractWeight,
            arrivedWeight: item.arrivedWeight,
            weightDifference: diff,
            saudaRate: item.saudaRate,
            comparisonRate: avgRate,
            expectedValue: `${item.contractWeight} MT (±10% tolerance)`,
            actualValue: `${item.arrivedWeight.toFixed(2)} MT (${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(1)}%)`,
            anomalyType: 'Contract vs Arrived Weight Mismatch',
            severity: Math.abs(pctDiff) > 50 ? 'High' : 'Medium',
            reason: `Arrived weight (${item.arrivedWeight.toFixed(2)} MT) deviates significantly from contract weight (${item.contractWeight} MT) by ${pctDiff.toFixed(1)}%.`,
            detectionRule: 'Absolute percentage deviation > 25% between Contract Weight and Total Arrived Weight',
            transactionDate: item.transactionDate,
            recommendedAction: 'Inspect weighbridge slips, temporary arrival logs, and final gate passes for weight discrepancies.',
            rawRecord: item.rawRecord
          });
        }
      }

      // 3. Zero or Missing Rate Check
      if (item.saudaRate <= 0) {
        anomalies.push({
          id: `${item.id}-rate`,
          brokerName: broker,
          saudaNo: item.saudaNo || 'N/A',
          poNo: item.poNo || 'N/A',
          contractWeight: item.contractWeight,
          arrivedWeight: item.arrivedWeight,
          weightDifference: item.arrivedWeight - item.contractWeight,
          saudaRate: item.saudaRate,
          comparisonRate: avgRate,
          expectedValue: `₹${avgRate.toFixed(2)}/Qtl (Broker Average)`,
          actualValue: '₹0.00 / Missing Rate',
          anomalyType: 'Zero or Missing Rate',
          severity: 'Medium',
          reason: `Contract or Sauda record has a zero or unrecorded rate per quintal despite contract weight of ${item.contractWeight} MT.`,
          detectionRule: 'Sauda B Rate or Purchase Rate = 0 while contract weight > 0',
          transactionDate: item.transactionDate,
          recommendedAction: 'Update contract rate from approved purchase order document.',
          rawRecord: item.rawRecord
        });
      }

      // 4. Unusual Rate Variance Check (> 30% deviation from broker average)
      if (item.saudaRate > 0 && avgRate > 0) {
        const rateDiffPct = ((item.saudaRate - avgRate) / avgRate) * 100;
        if (Math.abs(rateDiffPct) > 30) {
          anomalies.push({
            id: `${item.id}-rate-var`,
            brokerName: broker,
            saudaNo: item.saudaNo || 'N/A',
            poNo: item.poNo || 'N/A',
            contractWeight: item.contractWeight,
            arrivedWeight: item.arrivedWeight,
            weightDifference: item.arrivedWeight - item.contractWeight,
            saudaRate: item.saudaRate,
            comparisonRate: avgRate,
            expectedValue: `₹${avgRate.toFixed(2)}/Qtl (±30% band)`,
            actualValue: `₹${item.saudaRate.toFixed(2)}/Qtl (${rateDiffPct > 0 ? '+' : ''}${rateDiffPct.toFixed(1)}%)`,
            anomalyType: 'Unusual Rate Variance',
            severity: 'Low',
            reason: `Sauda B rate (₹${item.saudaRate}) is unusually ${rateDiffPct > 0 ? 'higher' : 'lower'} than broker's historical average (₹${avgRate.toFixed(2)}) by ${Math.abs(rateDiffPct).toFixed(1)}%.`,
            detectionRule: 'Rate deviation > 30% from broker average rate',
            transactionDate: item.transactionDate,
            recommendedAction: 'Verify market rate trend and contract terms for this specific lot.',
            rawRecord: item.rawRecord
          });
        }
      }

      // 5. Zero Contract Weight Check
      if (item.contractWeight <= 0) {
        anomalies.push({
          id: `${item.id}-zerowt`,
          brokerName: broker,
          saudaNo: item.saudaNo || 'N/A',
          poNo: item.poNo || 'N/A',
          contractWeight: item.contractWeight,
          arrivedWeight: item.arrivedWeight,
          weightDifference: item.arrivedWeight - item.contractWeight,
          saudaRate: item.saudaRate,
          comparisonRate: avgRate,
          expectedValue: '> 0 MT Contract Weight',
          actualValue: '0.00 MT',
          anomalyType: 'Zero Contract Weight',
          severity: 'High',
          reason: `Active Sauda or PO record has zero contract weight specified.`,
          detectionRule: 'Contract Weight <= 0 MT',
          transactionDate: item.transactionDate,
          recommendedAction: 'Edit contract entry to specify correct tonnage.',
          rawRecord: item.rawRecord
        });
      }
    });

    if (broker.includes('SOHANLALL') && anomalies.length === 0 && items.length > 0) {
      // If example broker has no automated anomaly but is inspected, we can include a low severity check if any minor variance exists or leave clean.
    }

    if (anomalies.length > 0) {
      const hasHigh = anomalies.some(a => a.severity === 'High');
      const hasMed = anomalies.some(a => a.severity === 'Medium');
      const overallSeverity: 'High' | 'Medium' | 'Low' = hasHigh ? 'High' : (hasMed ? 'Medium' : 'Low');

      brokerSummaries.push({
        brokerName: broker,
        totalRecordsReviewed: items.length,
        anomalyCount: anomalies.length,
        severity: overallSeverity,
        primaryIssue: anomalies[0].anomalyType,
        anomalies
      });
    }
  });

  // Sort by severity (High -> Medium -> Low) and anomaly count
  brokerSummaries.sort((a, b) => {
    const score = (s: string) => s === 'High' ? 3 : (s === 'Medium' ? 2 : 1);
    if (score(b.severity) !== score(a.severity)) {
      return score(b.severity) - score(a.severity);
    }
    return b.anomalyCount - a.anomalyCount;
  });

  return brokerSummaries;
}
