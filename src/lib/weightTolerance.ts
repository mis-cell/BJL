/**
 * Sauda Weight Acceptance Policy & Tolerance Calculation
 * 
 * Business Rules:
 * 1. BALE-SPECIFIC TOLERANCE (Unit / Lorry = 'BALES' - case-insensitive):
 *    - 3% of Sauda Quantity (in MT) OR 1500 KG (1.500 MT), whichever tolerance is HIGHER.
 *      Allowed Tolerance = MAX(3% of Sauda Quantity, 1.500 MT)
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
  toleranceMt: number;
  tolerancePct: number;
  minAcceptableMt: number;
  maxAcceptableMt: number;
  isAcceptable: boolean;
  isCompleted: boolean;
  isUnderDelivery: boolean;
  isOverDelivery: boolean;
  status: 'completed' | 'partial' | 'pending' | 'mismatch';
  statusLabel: 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'WEIGHT MISMATCH';
  formattedTolerance: string; // e.g. "±1.500 MT" or "Standard"
  formattedRange: string;     // e.g. "8.500 – 11.500 MT" or "≥ 10.000 MT"
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
    const minFixedToleranceMt = 1.5; // 1500 KG = 1.500 MT

    // Allowed Tolerance = MAX(3% of Sauda Quantity, 1500 KG / 1.500 MT)
    const toleranceMt = contractMt > 0 ? Math.max(pct3Mt, minFixedToleranceMt) : 0;
    const tolerancePct = contractMt > 0 ? (toleranceMt / contractMt) * 100 : 0;

    const minAcceptableMt = Math.max(0, contractMt - toleranceMt);
    const maxAcceptableMt = contractMt + toleranceMt;

    const isWithinTolerance = contractMt > 0 && receivedMt >= (minAcceptableMt - 0.0001) && receivedMt <= (maxAcceptableMt + 0.0001);
    const isOverDelivery = contractMt > 0 && receivedMt > (maxAcceptableMt + 0.0001);
    const isUnderDelivery = contractMt > 0 && receivedMt > 0 && receivedMt < (minAcceptableMt - 0.0001);

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
      toleranceMt,
      tolerancePct,
      minAcceptableMt,
      maxAcceptableMt,
      isAcceptable: isWithinTolerance,
      isCompleted: isWithinTolerance,
      isUnderDelivery,
      isOverDelivery,
      status,
      statusLabel,
      formattedTolerance: `±${toleranceMt.toFixed(3)} MT`,
      formattedRange: `${minAcceptableMt.toFixed(3)} – ${maxAcceptableMt.toFixed(3)} MT`
    };
  }

  // Non-Bale Units (e.g. KG, MT, TON, LORRY, DRUMS):
  // Existing system validation rules (no 3% / 1500 KG tolerance applied)
  const isCompleted = contractMt > 0 && receivedMt >= (contractMt - 0.05);
  const isOverDelivery = contractMt > 0 && receivedMt > (contractMt + 0.05);
  const isUnderDelivery = contractMt > 0 && receivedMt > 0 && receivedMt < (contractMt - 0.05);

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
    toleranceMt: 0,
    tolerancePct: 0,
    minAcceptableMt: contractMt,
    maxAcceptableMt: contractMt,
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
