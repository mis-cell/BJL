/**
 * Sauda Weight Acceptance Policy & Tolerance Calculation
 * 
 * Standard Business Rules:
 * 1. 3% of Sauda Quantity (in MT) OR 1500 KG (1.500 MT), whichever tolerance is HIGHER.
 *    Allowed Tolerance = MAX(3% of Sauda Quantity, 1.500 MT)
 * 2. Minimum Acceptable Weight = Sauda Quantity - Allowed Tolerance
 *    Maximum Acceptable Weight = Sauda Quantity + Allowed Tolerance
 * 3. Status logic:
 *    - If receivedWeight == 0: 'pending' (Awaiting Delivery)
 *    - If receivedWeight >= minAcceptable && receivedWeight <= maxAcceptable: 'completed' (Complete / Acceptable)
 *    - If receivedWeight > maxAcceptable: 'mismatch' (Weight Mismatch - Over Delivery)
 *    - If receivedWeight > 0 && receivedWeight < minAcceptable: 'partial' (Partial Delivery)
 */

export interface WeightToleranceResult {
  contractMt: number;
  receivedMt: number;
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
  formattedTolerance: string; // e.g. "±1.500 MT"
  formattedRange: string;     // e.g. "8.500 – 11.500 MT"
}

export function calculateWeightTolerance(
  contractWeight: number | string | null | undefined,
  receivedWeight: number | string | null | undefined
): WeightToleranceResult {
  const contractMt = Math.max(0, parseFloat(String(contractWeight ?? 0)) || 0);
  const receivedMt = Math.max(0, parseFloat(String(receivedWeight ?? 0)) || 0);

  // 3% of contract quantity in MT
  const pct3Mt = contractMt * 0.03;
  const minFixedToleranceMt = 1.5; // 1500 KG = 1.500 MT

  // Allowed Tolerance = MAX(3% of Sauda Quantity, 1500 KG / 1.500 MT)
  // If contract is 0, tolerance is 0
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
