// Satta-based Deduction Calculation Service
// Calculates Deduction (₹/Qtl) in Payment Section based on Satta Chart grade differentials
// ALL RATES AND DIFFERENTIALS FETCHED EXCLUSIVELY FROM SUPABASE DATABASE TABLES (satta_differentials, satta_calculated_rates)
// ZERO hardcoded rates, ZERO hardcoded fallbacks.

import {
  SattaDifferential,
  resolveSattaDifferential,
  normalizeGrade,
  getNextLowerGrade,
  getCandidateAreas,
  setCachedSattaDifferentials,
  getCachedSattaDifferentials,
  GRADE_SEQUENCES
} from './sattaRateService';

export type { SattaDifferential };
export { normalizeGrade, getNextLowerGrade, getCandidateAreas, GRADE_SEQUENCES };

// Re-export for components that populate or access cached differentials
export const setCachedSattaDiffs = (diffs: any[]) => {
  setCachedSattaDifferentials(diffs);
};

export const getCachedSattaDiffs = () => {
  return getCachedSattaDifferentials();
};

export interface SattaDiffQueryResult {
  differential: number | null;
  matchedArea: string;
  found: boolean;
  error?: string;
}

/**
 * Retrieve differential for a specific area and grade exclusively from Supabase differentials.
 * If not present in Supabase table, returns found: false with clear error.
 * NO HARDCODED SEED FALLBACKS.
 */
export function getSattaDiff(
  area?: string | null,
  grade?: string | null,
  agency?: string | null,
  dbDiffsList?: SattaDifferential[]
): SattaDiffQueryResult {
  const normGrade = normalizeGrade(grade);
  if (!normGrade) {
    return {
      differential: null,
      matchedArea: '',
      found: false,
      error: 'Grade not specified'
    };
  }

  const res = resolveSattaDifferential(area, grade, agency, dbDiffsList);
  if (res.found && res.differential !== null) {
    return {
      differential: res.differential,
      matchedArea: res.matchedArea || '',
      found: true
    };
  }

  return {
    differential: null,
    matchedArea: '',
    found: false,
    error: res.error || `Differential for grade '${normGrade}' in area '${area || agency || 'Unknown'}' not found in Supabase table`
  };
}

export interface SattaDeductionResult {
  deduction: number;         // Calculated Deduction (₹/Qtl) = GradeDiff * (Sett% / 100)
  gradeDiff: number;         // Absolute Satta differential difference between current and lower grade
  currentGrade: string;      // Contracted / original grade (e.g. 'TD6')
  lowerGrade: string | null; // Next grade down or stock grade (e.g. 'TD7')
  currentDiff: number;       // Satta differential of current grade (e.g. 900)
  lowerDiff: number;         // Satta differential of lower grade (e.g. 500)
  settPct: number;           // Settlement % (Claim %) (e.g. 30%)
  origRate: number;          // Original Rate (₹/Qtl)
  settRate: number;          // Settled Rate = origRate - deduction (₹/Qtl)
  explanation: string;       // Formatted explanation for tooltips & verification
  rateNotFound?: boolean;    // Flag indicating rate was not found in Supabase table
  error?: string;            // Clear error description if missing from database
}

/**
 * Calculates Deduction (₹/Qtl) for Payment Section using the Satta Chart.
 * 
 * Formula:
 * Grade Difference = |SattaDiff(ContractedGrade) - SattaDiff(NextLowerGrade)|
 * Deduction (₹/Qtl) = Grade Difference * (Settlement % / 100)
 * Sett Rate (₹/Qtl) = Original Rate (₹/Qtl) - Deduction (₹/Qtl)
 * 
 * Rates and differentials are retrieved strictly from Supabase `satta_differentials`.
 * If any required rate is missing in Supabase, returns a clear error message.
 * NEVER silently uses hardcoded or default rates.
 */
export function calculateSattaDeduction(
  col: {
    grade?: string | null;
    area?: string | null;
    agency?: string | null;
    rate_value?: number | string | null;
    sett_pct?: number | string | null;
    gd_claim?: number | string | null;
    gd_sett?: number | string | null;
    stock_grade_name?: string | null;
    stock_grade_code?: string | null;
  },
  dbDiffsList?: SattaDifferential[],
  customSettPct?: number
): SattaDeductionResult {
  const currentGrade = normalizeGrade(col.grade) || 'TD6';
  const origRate = Number(col.rate_value) || 0;

  // Determine Settlement / Claim %
  let settPct = 0;
  if (customSettPct !== undefined && !isNaN(customSettPct)) {
    settPct = customSettPct;
  } else if (col.sett_pct !== undefined && col.sett_pct !== null && col.sett_pct !== "" && !isNaN(Number(col.sett_pct)) && Number(col.sett_pct) > 0) {
    settPct = Number(col.sett_pct);
  } else if (col.gd_claim !== undefined && col.gd_claim !== null && !isNaN(Number(col.gd_claim)) && Number(col.gd_claim) > 0) {
    settPct = Number(col.gd_claim);
  } else if (col.gd_sett !== undefined && col.gd_sett !== null && !isNaN(Number(col.gd_sett)) && Number(col.gd_sett) > 0) {
    settPct = Number(col.gd_sett);
  } else if (col.sett_pct !== undefined && col.sett_pct !== null && !isNaN(Number(col.sett_pct))) {
    settPct = Number(col.sett_pct);
  }

  // Determine target downgraded grade
  let lowerGrade: string | null = null;
  const stockGrade = normalizeGrade(col.stock_grade_name || col.stock_grade_code);
  if (stockGrade && stockGrade !== currentGrade) {
    lowerGrade = stockGrade;
  } else {
    lowerGrade = getNextLowerGrade(currentGrade);
  }

  if (settPct <= 0 || !lowerGrade) {
    return {
      deduction: 0,
      gradeDiff: 0,
      currentGrade,
      lowerGrade,
      currentDiff: 0,
      lowerDiff: 0,
      settPct,
      origRate,
      settRate: origRate,
      explanation: settPct <= 0 ? 'No settlement / claim % applied' : 'No lower grade in hierarchy'
    };
  }

  // Look up differentials strictly from Supabase table
  const currDiffRes = getSattaDiff(col.area, currentGrade, col.agency, dbDiffsList);
  const lowerDiffRes = getSattaDiff(col.area, lowerGrade, col.agency, dbDiffsList);

  // If rate is not found in the Supabase table, show clear error without using hardcoded rate
  if (!currDiffRes.found || currDiffRes.differential === null) {
    const errorMsg = `Satta Rate not found in Supabase table for ${col.area || col.agency || 'Area'} - Grade ${currentGrade}`;
    return {
      deduction: 0,
      gradeDiff: 0,
      currentGrade,
      lowerGrade,
      currentDiff: 0,
      lowerDiff: 0,
      settPct,
      origRate,
      settRate: origRate,
      rateNotFound: true,
      error: errorMsg,
      explanation: `Error: ${errorMsg}`
    };
  }

  if (!lowerDiffRes.found || lowerDiffRes.differential === null) {
    const errorMsg = `Satta Rate not found in Supabase table for ${col.area || col.agency || 'Area'} - Downgraded Grade ${lowerGrade}`;
    return {
      deduction: 0,
      gradeDiff: 0,
      currentGrade,
      lowerGrade,
      currentDiff: currDiffRes.differential,
      lowerDiff: 0,
      settPct,
      origRate,
      settRate: origRate,
      rateNotFound: true,
      error: errorMsg,
      explanation: `Error: ${errorMsg}`
    };
  }

  const currentDiff = currDiffRes.differential;
  const lowerDiff = lowerDiffRes.differential;

  // Grade Difference = |currentDiff - lowerDiff| (computed directly from Supabase values)
  const gradeDiff = Math.abs(currentDiff - lowerDiff);

  // Deduction = Grade Difference * (Settlement % / 100)
  const deduction = Number(((gradeDiff * settPct) / 100).toFixed(2));
  const settRate = Math.max(0, Number((origRate - deduction).toFixed(2)));
  const matchedAreaName = currDiffRes.matchedArea || lowerDiffRes.matchedArea || col.area || 'Supabase Satta Table';

  const explanation = `Satta Table (${matchedAreaName}): ${currentGrade} (₹${currentDiff}) vs ${lowerGrade} (₹${lowerDiff}) = ₹${gradeDiff} Diff × ${settPct}% Claim = ₹${deduction.toFixed(2)}/Qtl`;

  return {
    deduction,
    gradeDiff,
    currentGrade,
    lowerGrade,
    currentDiff,
    lowerDiff,
    settPct,
    origRate,
    settRate,
    explanation
  };
}
