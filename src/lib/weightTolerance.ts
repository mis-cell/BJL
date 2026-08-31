/**
 * Sauda Weight Acceptance Policy & Tolerance Calculation
 * 
 * Business Rules:
 * 1. BALE-SPECIFIC TOLERANCE (Unit / Lorry = 'BALES' - case-insensitive):
 *    - 3% of Sauda Quantity (in MT) OR 1500 KG (1.500 MT), whichever tolerance is LOWER.
 *      Allowed Tolerance = MIN(3% of Sauda Quantity, 1.500 MT)
 *    - Minimum Acceptable Weight = Sauda Quantity - Allowed Tolerance
 *    - Maximum Acceptable Weight = Sauda Quantity + Allowed Tolerance
 *    - Within range [Minimum Acceptable, Maximum Acceptable] => Status = 'completed' (COMPLETED)
 *    - Outside range => Status = 'mismatch' (WEIGHT MISMATCH / NOT ACCEPTABLE) or 'partial' (PARTIAL)
 * 
 * 2. NON-BALE UNITS (Unit / Lorry ≠ 'BALES', e.g. KG, MT, TON, LORRY, DRUMS):
 *    - Do NOT apply the 3% / 1500 KG rule.
 *    - Follow existing standard validation logic (completed when received weight meets contract weight).
 */

export interface WeightToleranceResult {
  contractMt: number;
  receivedMt: number;
  unit: string;
  isBales: boolean;
  pct3Mt: number;
  fixedToleranceMt: number;
  toleranceMt: number;
  tolerancePct: number;
  toleranceBasis: '3% (Lower)' | '1500 KG (Lower)' | 'Standard';
  minAcceptableMt: number;
  maxAcceptableMt: number;
  excessOverToleranceMt: number;
  excessOverContractMt: number;
  shortUnderToleranceMt: number;
  isAcceptable: boolean;
  isCompleted: boolean;
  isUnderDelivery: boolean;
  isOverDelivery: boolean;
  status: 'completed' | 'partial' | 'pending' | 'mismatch';
  statusLabel: 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'WEIGHT MISMATCH';
  formattedTolerance: string; // e.g. "±1.261 MT (3%)" or "±1.500 MT"
  formattedRange: string;     // e.g. "40.778 – 43.300 MT"
}

export function isBaleUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  const u = String(unit).trim().toUpperCase();
  return u === 'BALES' || u === 'BALE';
}

export function calculateWeightTolerance(
  contractWeight: number | string | null | undefined,
  receivedWeight: number | string | null | undefined,
  unit?: string | null | undefined
): WeightToleranceResult {
  const contractMt = Math.max(0, parseFloat(String(contractWeight ?? 0)) || 0);
  const receivedMt = Math.max(0, parseFloat(String(receivedWeight ?? 0)) || 0);
  const unitStr = String(unit || 'BALES').trim().toUpperCase();
  const isBales = isBaleUnit(unitStr);

  if (isBales) {
    // 3% of contract quantity in MT
    const pct3Mt = contractMt * 0.03;
    const fixedToleranceMt = 1.5; // 1500 KG = 1.500 MT

    // Allowed Tolerance = MIN(3% of Sauda Quantity, 1500 KG / 1.500 MT) - whichever is LOWER
    const toleranceMt = contractMt > 0 ? Math.min(pct3Mt, fixedToleranceMt) : 0;
    const tolerancePct = contractMt > 0 ? (toleranceMt / contractMt) * 100 : 0;
    const toleranceBasis = contractMt > 0 
      ? (pct3Mt <= fixedToleranceMt ? '3% (Lower)' : '1500 KG (Lower)')
      : 'Standard';

    const minAcceptableMt = Math.max(0, contractMt - toleranceMt);
    const maxAcceptableMt = contractMt + toleranceMt;

    const isWithinTolerance = contractMt > 0 && receivedMt >= (minAcceptableMt - 0.0001) && receivedMt <= (maxAcceptableMt + 0.0001);
    const isOverDelivery = contractMt > 0 && receivedMt > (maxAcceptableMt + 0.0001);
    const isUnderDelivery = contractMt > 0 && receivedMt > 0 && receivedMt < (minAcceptableMt - 0.0001);

    const excessOverToleranceMt = isOverDelivery ? Math.max(0, receivedMt - maxAcceptableMt) : 0;
    const excessOverContractMt = receivedMt > contractMt ? Math.max(0, receivedMt - contractMt) : 0;
    const shortUnderToleranceMt = isUnderDelivery ? Math.max(0, minAcceptableMt - receivedMt) : 0;

    let status: 'completed' | 'partial' | 'pending' | 'mismatch' = 'pending';
    let statusLabel: 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'WEIGHT MISMATCH' = 'PENDING';

    if (contractMt > 0) {
      if (isWithinTolerance) {
        status = 'completed';
        statusLabel = 'COMPLETED';
      } else if (isOverDelivery) {
        status = 'mismatch';
        statusLabel = 'WEIGHT MISMATCH';
      } else if (receivedMt > 0) {
        status = 'partial';
        statusLabel = 'PARTIAL';
      } else {
        status = 'pending';
        statusLabel = 'PENDING';
      }
    }

    return {
      contractMt,
      receivedMt,
      unit: unitStr,
      isBales: true,
      pct3Mt,
      fixedToleranceMt,
      toleranceMt,
      tolerancePct,
      toleranceBasis,
      minAcceptableMt,
      maxAcceptableMt,
      excessOverToleranceMt,
      excessOverContractMt,
      shortUnderToleranceMt,
      isAcceptable: isWithinTolerance,
      isCompleted: isWithinTolerance,
      isUnderDelivery,
      isOverDelivery,
      status,
      statusLabel,
      formattedTolerance: `±${toleranceMt.toFixed(3)} MT (${tolerancePct.toFixed(1)}%)`,
      formattedRange: `${minAcceptableMt.toFixed(3)} – ${maxAcceptableMt.toFixed(3)} MT`
    };
  }

  // Non-Bale Units (e.g. KG, MT, TON, LORRY, DRUMS):
  // Existing system validation rules (no 3% / 1500 KG tolerance applied)
  const isCompleted = contractMt > 0 && receivedMt >= (contractMt - 0.05);
  const isOverDelivery = contractMt > 0 && receivedMt > (contractMt + 0.05);
  const isUnderDelivery = contractMt > 0 && receivedMt > 0 && receivedMt < (contractMt - 0.05);

  const excessOverToleranceMt = isOverDelivery ? Math.max(0, receivedMt - contractMt) : 0;
  const excessOverContractMt = receivedMt > contractMt ? Math.max(0, receivedMt - contractMt) : 0;
  const shortUnderToleranceMt = isUnderDelivery ? Math.max(0, contractMt - receivedMt) : 0;

  let status: 'completed' | 'partial' | 'pending' | 'mismatch' = 'pending';
  let statusLabel: 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'WEIGHT MISMATCH' = 'PENDING';

  if (contractMt > 0) {
    if (isCompleted) {
      status = 'completed';
      statusLabel = 'COMPLETED';
    } else if (receivedMt > 0) {
      status = 'partial';
      statusLabel = 'PARTIAL';
    } else {
      status = 'pending';
      statusLabel = 'PENDING';
    }
  }

  return {
    contractMt,
    receivedMt,
    unit: unitStr,
    isBales: false,
    pct3Mt: 0,
    fixedToleranceMt: 0,
    toleranceMt: 0,
    tolerancePct: 0,
    toleranceBasis: 'Standard',
    minAcceptableMt: contractMt,
    maxAcceptableMt: contractMt,
    excessOverToleranceMt,
    excessOverContractMt,
    shortUnderToleranceMt,
    isAcceptable: isCompleted,
    isCompleted,
    isUnderDelivery,
    isOverDelivery,
    status,
    statusLabel,
    formattedTolerance: 'Standard',
    formattedRange: `${contractMt.toFixed(3)} MT`
  };
}
