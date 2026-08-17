import { calculateWeightTolerance } from './weightTolerance';

// Temporary P.O  ↔  Material Inspection / Final M.R field-by-field comparison.
//
// Compared fields (Sauda Check Point ↔ Temporary P.O ↔ Material Inspection):
//   1. Purchase Order
//   2. Broker
//   3. Supplier
//   4. Challan Supplier
//   5. Area
//   6. Total Contract (M.Ton) (Evaluated only if single lorry and after receipt)
//   7. Grade
//   8. Agency
//   9. Rate / M.T

export interface FieldMismatch {
  field: string;           // e.g. "Broker", "Grade", "Agency", etc.
  mismatchLabel: string;   // e.g. "Broker mismatch", "Grade mismatch", etc.
  poValue: string;
  inspValue: string;
}

export type PoMismatchDetail = FieldMismatch;

export type MatchSeverity = 'match' | 'mismatch';

export interface LorryProgress {
  totalLorries: number;
  receivedLorries: number;
  remainingLorries: number;
}

export interface PoMatchResult {
  poNo: string;
  hasInspection: boolean;   // false = no matching Material Inspection found yet
  status: MatchSeverity;    // 'match' (green / Pass) or 'mismatch' (red)
  mismatches: FieldMismatch[];
  lorryProgress?: LorryProgress;
  totalContractMt?: number;
  totalReceivedMt?: number;
}

// Standard Jute Grade Code <-> Grade Name mapping dictionary
const GRADE_CODE_NAME_MAP: Record<string, string> = {
  '831': 'TD5', 'TD5': '831',
  '832': 'TD6', 'TD6': '832',
  '833': 'TD7', 'TD7': '833',
  '834': 'TD8', 'TD8': '834',
  '835': 'W5',  'W5': '835',
  '836': 'W6',  'W6': '836',
  '837': 'W7',  'W7': '837',
  '838': 'W8',  'W8': '838',
  '839': 'M5',  'M5': '839',
  '840': 'M6',  'M6': '840',
  '841': 'M7',  'M7': '841',
  '842': 'M8',  'M8': '842',
  '843': 'B.TOW', 'BTOW': '843',
};

// Agency Code <-> Agency Name mapping dictionary
const AGENCY_CODE_NAME_MAP: Record<string, string> = {
  '1': 'KOLKATA', 'KOLKATA': '1',
  '2': 'CALLY', 'CALLY': '2',
  '3': 'TALLY', 'TALLY': '3',
  '4': 'ASSAM', 'ASSAM': '4',
  '5': 'DHUBRI', 'DHUBRI': '5',
  '6': 'GAUHATI', 'GAUHATI': '6',
  '7': 'KISHANGANJ', 'KISHANGANJ': '7',
  '8': 'SILIGURI', 'SILIGURI': '8',
};

function cleanStr(v: unknown): string {
  return String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function expandGradeTokens(input: any): Set<string> {
  const tokens = new Set<string>();
  if (!input) return tokens;

  const rawValues = Array.isArray(input) ? input : [input];
  for (const raw of rawValues) {
    if (!raw) continue;
    const str = String(raw).trim().toUpperCase();
    if (!str) continue;

    const c = cleanStr(str);
    if (c) {
      tokens.add(c);
      if (GRADE_CODE_NAME_MAP[c]) {
        tokens.add(cleanStr(GRADE_CODE_NAME_MAP[c]));
      }
    }

    const parts = str.split(/[,/\\;|\-\s]+/);
    for (const p of parts) {
      const pc = cleanStr(p);
      if (pc) {
        tokens.add(pc);
        if (GRADE_CODE_NAME_MAP[pc]) {
          tokens.add(cleanStr(GRADE_CODE_NAME_MAP[pc]));
        }
      }
    }
  }
  return tokens;
}

function expandAgencyTokens(input: any): Set<string> {
  const tokens = new Set<string>();
  if (!input) return tokens;

  const rawValues = Array.isArray(input) ? input : [input];
  for (const raw of rawValues) {
    if (!raw) continue;
    const str = String(raw).trim().toUpperCase();
    if (!str) continue;

    const c = cleanStr(str);
    if (c) {
      tokens.add(c);
      if (AGENCY_CODE_NAME_MAP[c]) {
        tokens.add(cleanStr(AGENCY_CODE_NAME_MAP[c]));
      }
    }

    const parts = str.split(/[,/\\;|\-\s]+/);
    for (const p of parts) {
      const pc = cleanStr(p);
      if (pc) {
        tokens.add(pc);
        if (AGENCY_CODE_NAME_MAP[pc]) {
          tokens.add(cleanStr(AGENCY_CODE_NAME_MAP[pc]));
        }
      }
    }
  }
  return tokens;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? NaN : n;
}

/**
 * Compare a Sauda Check Point / Temporary P.O against its Material Inspection record.
 * @param po         sauda_check_point / purchase_master row
 * @param _poItems   detail items for PO
 * @param insp       matching mill_inspection_master / temporary_material_received row, or null
 * @param _inspItems detail items for inspection / array of all lorry receipts for PO
 */
export function comparePoInspection(
  po: any,
  _poItems: any[] = [],
  insp: any | null = null,
  _inspItems: any[] = [],
): PoMatchResult {
  const poNo = String(po?.po_no || po?.contract_po_no || '').trim();

  if (!insp) {
    return {
      poNo,
      hasInspection: false,
      status: 'match',
      mismatches: [],
    };
  }

  const mismatches: FieldMismatch[] = [];

  // Parse grid details from insp if string
  let parsedInspGrids: any[] = [];
  if (insp.grid_details) {
    try {
      parsedInspGrids = typeof insp.grid_details === 'string' ? JSON.parse(insp.grid_details) : insp.grid_details;
      if (!Array.isArray(parsedInspGrids)) parsedInspGrids = [];
    } catch (_e) {
      parsedInspGrids = [];
    }
  }

  // Also include items from _inspItems if any
  const allInspGridRows = [...parsedInspGrids];
  if (Array.isArray(_inspItems)) {
    _inspItems.forEach(item => {
      if (item && item.grid_details) {
        try {
          const g = typeof item.grid_details === 'string' ? JSON.parse(item.grid_details) : item.grid_details;
          if (Array.isArray(g)) allInspGridRows.push(...g);
        } catch (_e) {}
      }
    });
  }

  // --- 1. BROKER ---
  const poBroker = po.broker ?? po.broker_name;
  const inspBroker = insp.broker ?? insp.broker_name;
  if (poBroker && inspBroker) {
    const cPo = cleanStr(poBroker);
    const cInsp = cleanStr(inspBroker);
    if (cPo && cInsp && cPo !== cInsp && !cPo.includes(cInsp) && !cInsp.includes(cPo)) {
      mismatches.push({
        field: 'Broker',
        mismatchLabel: 'Broker mismatch',
        poValue: String(poBroker),
        inspValue: String(inspBroker),
      });
    }
  }

  // --- 2. SUPPLIER ---
  const poSupplier = po.supplier ?? po.supplier_name ?? po.party_name;
  const inspSupplier = insp.supplier ?? insp.supplier_name ?? insp.party_name;
  if (poSupplier && inspSupplier) {
    const cPo = cleanStr(poSupplier);
    const cInsp = cleanStr(inspSupplier);
    if (cPo && cInsp && cPo !== cInsp && !cPo.includes(cInsp) && !cInsp.includes(cPo)) {
      mismatches.push({
        field: 'Supplier',
        mismatchLabel: 'Supplier mismatch',
        poValue: String(poSupplier),
        inspValue: String(inspSupplier),
      });
    }
  }

  // --- 3. CHALLAN SUPPLIER ---
  const poChallanSupplier = po.challan_supplier ?? po.challan_party;
  const inspChallanSupplier = insp.challan_supplier ?? insp.challan_party;
  if (poChallanSupplier && inspChallanSupplier) {
    const cPo = cleanStr(poChallanSupplier);
    const cInsp = cleanStr(inspChallanSupplier);
    if (cPo && cInsp && cPo !== cInsp && !cPo.includes(cInsp) && !cInsp.includes(cPo)) {
      mismatches.push({
        field: 'Challan Supplier',
        mismatchLabel: 'Challan Supplier mismatch',
        poValue: String(poChallanSupplier),
        inspValue: String(inspChallanSupplier),
      });
    }
  }

  // --- 4. P.T.F MODE ---
  // P.T.F Mode (Normal / PTF / Local / No / Yes) is an operational transport flag and is intentionally NOT evaluated as a mismatch.

  // --- 5. P.O CONTRACT ---
  const poPoContract = po.po_contract ?? po.contract_no ?? po.sauda_no ?? po.contract_po_no;
  const inspPoContract = insp.po_contract ?? insp.contract_no ?? insp.sauda_no ?? insp.contract_po_no;
  if (poPoContract && inspPoContract) {
    const cPo = cleanStr(poPoContract);
    const cInsp = cleanStr(inspPoContract);
    const cPoNo = cleanStr(poNo);
    const cSaudaNo = cleanStr(po.sauda_no);
    const isIgnoredVal = (s: string) => !s || s === 'NO' || s === 'NA' || s === 'NONE' || s === 'NORMAL' || s === 'N';

    if (
      !isIgnoredVal(cPo) && !isIgnoredVal(cInsp) &&
      cPo !== cInsp &&
      !cPo.includes(cInsp) && !cInsp.includes(cPo) &&
      cInsp !== cPoNo && cPo !== cPoNo &&
      cInsp !== cSaudaNo && cPo !== cSaudaNo
    ) {
      mismatches.push({
        field: 'P.O Contract',
        mismatchLabel: 'P.O Contract mismatch',
        poValue: String(poPoContract),
        inspValue: String(inspPoContract),
      });
    }
  }

  // --- 6. AREA ---
  const poAreas = [po.area, po.arrival_area_name, po.area_name, po.sourcing_area];
  if (Array.isArray(_poItems)) _poItems.forEach(p => poAreas.push(p?.area, p?.area_name, p?.arrival_area_name));
  const cleanPoAreas = poAreas.map(cleanStr).filter(Boolean);

  const inspAreas = [insp.area, insp.arrival_area_name, insp.area_name, insp.sourcing_area];
  allInspGridRows.forEach(g => inspAreas.push(g?.area, g?.area_name, g?.arrival_area_name));
  const cleanInspAreas = inspAreas.map(cleanStr).filter(Boolean);

  if (cleanPoAreas.length > 0 && cleanInspAreas.length > 0) {
    const areaMatch = cleanInspAreas.some(ia => cleanPoAreas.some(pa => pa === ia || pa.includes(ia) || ia.includes(pa)));
    if (!areaMatch) {
      mismatches.push({
        field: 'Area',
        mismatchLabel: 'Area mismatch',
        poValue: Array.from(new Set(cleanPoAreas)).join(', '),
        inspValue: Array.from(new Set(cleanInspAreas)).join(', '),
      });
    }
  }

  // --- 7. GRADE ---
  const rawPoGrades: any[] = [po.quality, po.grade, po.grade_name, po.grade_code];
  if (Array.isArray(_poItems)) {
    _poItems.forEach(p => {
      rawPoGrades.push(p?.grade_name, p?.quality, p?.grade, p?.grade_code, p?.stock_grade_name, p?.stock_grade_code);
    });
  }
  const poGradeTokens = expandGradeTokens(rawPoGrades);

  const rawInspGrades: any[] = [insp.quality, insp.grade, insp.grade_name, insp.arrival_grade, insp.stock_grade, insp.stock_grade_name, insp.stock_grade_code];
  allInspGridRows.forEach(g => {
    rawInspGrades.push(g?.receipt_grade_code, g?.receipt_grade_name, g?.arrival_grade, g?.stock_grade_code, g?.stock_grade_name, g?.grade_code, g?.grade_name, g?.grade, g?.quality);
  });
  const inspGradeTokens = expandGradeTokens(rawInspGrades);

  if (poGradeTokens.size > 0 && inspGradeTokens.size > 0) {
    let allInspMatched = true;
    inspGradeTokens.forEach(token => {
      if (!poGradeTokens.has(token)) {
        allInspMatched = false;
      }
    });

    if (!allInspMatched) {
      mismatches.push({
        field: 'Grade',
        mismatchLabel: 'Grade mismatch',
        poValue: Array.from(poGradeTokens).filter(t => isNaN(Number(t))).join(', ') || Array.from(poGradeTokens).join(', '),
        inspValue: Array.from(inspGradeTokens).filter(t => isNaN(Number(t))).join(', ') || Array.from(inspGradeTokens).join(', '),
      });
    }
  }

  // --- 8. AGENCY ---
  const rawPoAgencies: any[] = [po.agency, po.agency_name, po.agency_code];
  if (Array.isArray(_poItems)) {
    _poItems.forEach(p => rawPoAgencies.push(p?.agency_name, p?.agency_code, p?.agency));
  }
  const poAgencyTokens = expandAgencyTokens(rawPoAgencies);

  const rawInspAgencies: any[] = [insp.agency, insp.agency_name, insp.agency_code];
  allInspGridRows.forEach(g => rawInspAgencies.push(g?.agency, g?.agency_name, g?.agency_code));
  const inspAgencyTokens = expandAgencyTokens(rawInspAgencies);

  if (poAgencyTokens.size > 0 && inspAgencyTokens.size > 0) {
    let agencyMatched = false;
    inspAgencyTokens.forEach(token => {
      if (poAgencyTokens.has(token)) agencyMatched = true;
    });

    if (!agencyMatched) {
      mismatches.push({
        field: 'Agency',
        mismatchLabel: 'Agency mismatch',
        poValue: Array.from(poAgencyTokens).join(', '),
        inspValue: Array.from(inspAgencyTokens).join(', '),
      });
    }
  }

  // --- 9. RATE / M.T ---
  const poRate = toNum(po.b_rate ?? po.rate_per_mt ?? (po.rate_qntl ? po.rate_qntl * 10 : NaN));
  const inspRate = toNum(insp.b_rate ?? insp.rate_per_mt ?? (insp.rate_qntl ? insp.rate_qntl * 10 : NaN));
  if (!isNaN(poRate) && !isNaN(inspRate) && Math.abs(poRate - inspRate) > 0.01) {
    mismatches.push({
      field: 'Rate / M.T',
      mismatchLabel: 'Rate mismatch',
      poValue: `₹ ${poRate.toFixed(2)}`,
      inspValue: `₹ ${inspRate.toFixed(2)}`,
    });
  }

  // --- 10. LORRY LOGIC & Total Contract (M.Ton) ---
  const contractMt = toNum(po.total_contract_mt ?? po.total_wt_in_ton ?? po.total_wt) || 0;

  let totalLorries = toNum(po.total_lorries ?? po.no_of_lorries ?? po.lorry_count);
  if (isNaN(totalLorries) || totalLorries <= 0) {
    totalLorries = Math.max(1, Math.round(contractMt / 12));
  }

  let receivedLorriesCount = 0;
  let totalReceivedWeightSum = 0;

  if (Array.isArray(_inspItems) && _inspItems.length > 0) {
    const uniqueLorries = new Set<string>();
    _inspItems.forEach((receipt: any) => {
      const lorryNo = String(receipt.lorry_number || receipt.lorry_no || '').trim().toUpperCase();
      if (lorryNo) uniqueLorries.add(lorryNo);

      let wt = toNum(receipt.total_wt_in_ton ?? receipt.total_wt);
      if (isNaN(wt) && receipt.weight_qtl != null) wt = toNum(receipt.weight_qtl) / 10;
      if (isNaN(wt) && receipt.total_actual_weight != null) wt = toNum(receipt.total_actual_weight) / 1000;
      if (!isNaN(wt)) totalReceivedWeightSum += wt;
    });
    receivedLorriesCount = uniqueLorries.size;
  } else if (insp) {
    receivedLorriesCount = 1;
    let wt = toNum(insp.total_wt_in_ton ?? insp.total_wt);
    if (isNaN(wt) && insp.weight_qtl != null) wt = toNum(insp.weight_qtl) / 10;
    if (isNaN(wt) && insp.total_actual_weight != null) wt = toNum(insp.total_actual_weight) / 1000;
    if (!isNaN(wt)) totalReceivedWeightSum = wt;
  }

  const remainingLorries = Math.max(0, totalLorries - receivedLorriesCount);

  // Weight check triggers if single lorry (totalLorries <= 1) and ALL lorries received (remainingLorries === 0).
  if (totalLorries <= 1 && remainingLorries === 0 && contractMt > 0 && totalReceivedWeightSum > 0) {
    const tol = calculateWeightTolerance(contractMt, totalReceivedWeightSum);
    if (!tol.isAcceptable) {
      mismatches.push({
        field: 'Total Contract (M.Ton)',
        mismatchLabel: tol.isOverDelivery ? 'Excess Weight (Over Tolerance)' : 'Short Weight (Under Tolerance)',
        poValue: `${contractMt.toFixed(3)} MT (${tol.formattedTolerance})`,
        inspValue: `${totalReceivedWeightSum.toFixed(3)} MT [Allowed: ${tol.formattedRange}]`,
      });
    }
  }

  return {
    poNo,
    hasInspection: true,
    status: mismatches.length === 0 ? 'match' : 'mismatch',
    mismatches,
    lorryProgress: {
      totalLorries,
      receivedLorries: receivedLorriesCount,
      remainingLorries,
    },
    totalContractMt: contractMt,
    totalReceivedMt: totalReceivedWeightSum,
  };
}
