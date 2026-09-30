/**
 * Single Source of Truth for Satta Rates and Differentials
 * 
 * All Satta Rates (Base Rate, Differentials, Calculated Rates) originate directly
 * from Supabase tables:
 * - satta_base_rates: Daily published base rates (e.g. TD5 base rate)
 * - satta_differentials: Area & grade specific differentials (+/- relative to base)
 * - satta_calculated_rates: Precomputed final rates (base_rate + differential)
 * 
 * ZERO hardcoded rates, ZERO fallback defaults. If not in Supabase, returns not found.
 */

import { supabase } from '../lib/supabase';

export interface SattaBaseRate {
  id: string;
  start_date: string;
  base_rate: number;
  created_at?: string;
  remarks?: string;
  status?: string;
}

export interface SattaDifferential {
  id?: string;
  area: string;
  grade: string;
  differential: number;
  created_at?: string;
}

export interface SattaCalculatedRate {
  id?: string;
  base_rate_id?: string;
  start_date: string;
  area: string;
  grade: string;
  differential: number;
  base_rate: number;
  final_rate: number;
  created_at?: string;
}

export interface SattaRateResult {
  found: boolean;
  baseRate: number | null;
  differential: number | null;
  finalRate: number | null;
  matchedArea: string | null;
  normGrade: string | null;
  startDate: string | null;
  error?: string;
}

export interface SattaDiffResult {
  found: boolean;
  differential: number | null;
  matchedArea: string | null;
  normGrade: string | null;
  error?: string;
}

// Global in-memory cache populated directly from Supabase
let cachedBaseRates: SattaBaseRate[] = [];
let cachedDifferentials: SattaDifferential[] = [];
let cachedCalculatedRates: SattaCalculatedRate[] = [];
let isCacheLoaded = false;
let cachePromise: Promise<void> | null = null;

// Normalize grade string (e.g. 'TD-6' -> 'TD6', 'TD 6' -> 'TD6', 'TD5 - SUPERIOR' -> 'TD5')
export function normalizeGrade(grade?: string | null): string {
  if (!grade) return '';
  const clean = String(grade).trim().toUpperCase();
  
  // Extract TD grades even with suffixes (e.g., 'TD-5', 'TD5 DAISEE', 'TD 5')
  const tdMatch = clean.match(/\bTD[\s\-_]*([0-9]+)/i) || clean.match(/^TD[\s\-_]*([0-9]+)/i);
  if (tdMatch) return `TD${tdMatch[1]}`;
  
  // Extract W grades (White Jute, e.g., 'W-5', 'W5', 'W 6')
  const wMatch = clean.match(/\bW[\s\-_]*([0-9]+)/i) || clean.match(/^W[\s\-_]*([0-9]+)/i);
  if (wMatch) return `W${wMatch[1]}`;

  // Extract Mesta grades (e.g. 'M-1', 'M2')
  const mMatch = clean.match(/\bM[\s\-_]*([0-9]+)/i) || clean.match(/^M[\s\-_]*([0-9]+)/i);
  if (mMatch) return `M${mMatch[1]}`;

  return clean.replace(/\./g, '').trim();
}

// Ordered standard jute grade hierarchies for grade downgrade progression
export const GRADE_SEQUENCES: string[][] = [
  ['TD1', 'TD2', 'TD3', 'TD4', 'TD5', 'TD6', 'TD7', 'TD8', 'TD9', 'TD10'],
  ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'LOOSE'],
  ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
  ['BTR HD KS', 'BTR HD CS', 'BTR HD BS', 'BTR NB KS', 'BTR NB FFS', 'BTR NB (SMR)'],
  ['M.S.MID', 'M.MID', 'M.BOT', 'M.B.BOT', 'M.X.BOT'],
  ['BOT', 'B.BOT', 'X.BOT', 'X.X.BOT']
];

export function getNextLowerGrade(currentGrade?: string | null): string | null {
  const norm = normalizeGrade(currentGrade);
  if (!norm) return null;

  for (const seq of GRADE_SEQUENCES) {
    const idx = seq.findIndex(g => normalizeGrade(g) === norm);
    if (idx !== -1 && idx < seq.length - 1) {
      return seq[idx + 1];
    }
  }

  const tdNumMatch = norm.match(/^TD([0-9]+)$/);
  if (tdNumMatch) {
    const nextNum = parseInt(tdNumMatch[1], 10) + 1;
    return `TD${nextNum}`;
  }

  const wNumMatch = norm.match(/^W([0-9]+)$/);
  if (wNumMatch) {
    const nextNum = parseInt(wNumMatch[1], 10) + 1;
    return `W${nextNum}`;
  }

  const mNumMatch = norm.match(/^M([0-9]+)$/);
  if (mNumMatch) {
    const nextNum = parseInt(mNumMatch[1], 10) + 1;
    return `M${nextNum}`;
  }

  return null;
}

/**
 * Standardize regional synonyms to match Supabase table area naming
 */
export function getCandidateAreas(area?: string | null, agency?: string | null): string[] {
  const cleanArea = String(area || '').trim().toUpperCase();
  const cleanAgency = String(agency || '').trim().toUpperCase();
  const candidates: string[] = [];

  // Purnea / Bihar synonyms: PURNEA(BIHAR) and BIHAR represent the same market
  if (
    cleanArea.includes('BIHAR') || 
    cleanArea.includes('PURNEA') || 
    cleanAgency.includes('GULABBAGH') || 
    cleanAgency.includes('PURNEA')
  ) {
    if (cleanArea.includes('LOOSE') || cleanAgency.includes('LOOSE')) {
      candidates.push('PURNEA (LOOSE)', 'PURNEA LOOSE', 'PURNEA(BIHAR)', 'BIHAR');
    } else {
      candidates.push('PURNEA(BIHAR)', 'BIHAR', 'PURNEA (LOOSE)', 'PURNEA LOOSE');
    }
  }

  // Lower Assam / Tarabari / Bilasipara: Treat all as L/A TARABARI
  if (
    cleanArea.includes('LOWER ASSAM') || 
    cleanArea.includes('L/A') || 
    cleanArea.includes('TARABARI') || 
    cleanArea.includes('BILASIPARA') ||
    cleanArea.includes('BELLOW ASSAM') ||
    cleanArea.includes('BELOW ASSAM') ||
    cleanAgency.includes('LOWER ASSAM') ||
    cleanAgency.includes('BILASIPARA') ||
    cleanAgency.includes('TARABARI') ||
    cleanAgency.includes('BELLOW ASSAM') ||
    cleanAgency.includes('BELOW ASSAM')
  ) {
    candidates.push('L/A TARABARI', 'LOWER ASSAM', 'BILASIPARA');
  }

  if (cleanArea.includes('U/ASSAM') || cleanArea.includes('UPPER ASSAM') || cleanAgency.includes('U/ASSAM')) {
    candidates.push('U/ASSAM', 'ASSAM');
  } else if (cleanArea.includes('ASSAM') && !cleanArea.includes('LOWER')) {
    candidates.push('ASSAM', 'U/ASSAM');
  }

  if (cleanArea.includes('DAISEE') || cleanAgency.includes('DAISEE')) candidates.push('DAISEE');
  if (cleanArea.includes('TULSIHATTA') || cleanAgency.includes('TULSIHATTA')) candidates.push('TULSIHATTA');
  if (cleanArea.includes('BANGLADESH') || cleanAgency.includes('BANGLADESH')) candidates.push('BANGLADESH');
  if (cleanArea.includes('GRP LOOSE') || cleanAgency.includes('GRP LOOSE')) candidates.push('GRP LOOSE');
  if (cleanArea.includes('KANKI') || cleanAgency.includes('KANKI')) candidates.push('KANKI');

  if (cleanArea.includes('RAIGANJ') || cleanAgency.includes('RAIGANJ')) {
    if (cleanArea.includes('LOOSE') || cleanAgency.includes('LOOSE')) {
      candidates.push('RAIGANJ Loose', 'RAIGANJ LOOSE', 'RAIGANJ');
    } else {
      candidates.push('RAIGANJ', 'RAIGANJ Loose', 'RAIGANJ LOOSE');
    }
  }

  if (
    cleanArea.includes('DHULIYAAN') || 
    cleanArea.includes('DHULIYAN') || 
    cleanArea.includes('DHULAIN') || 
    cleanAgency.includes('DHULIYAAN') || 
    cleanAgency.includes('DHULAIN')
  ) {
    candidates.push('DHULIYAAN');
  }

  if (cleanArea.includes('SAMSI') || cleanAgency.includes('SAMSI')) candidates.push('SAMSI JUNGLE');
  if (cleanArea.includes('NORTHERN') || cleanAgency.includes('NORTHERN')) candidates.push('NORTHERN', 'SEMI NORTHERN');
  if (cleanArea.includes('GAJAL') || cleanAgency.includes('GAJAL')) candidates.push('GAJAL LOOSE');
  if (cleanArea.includes('BADURIA') || cleanAgency.includes('BADURIA')) candidates.push('BADURIA');
  if (cleanArea.includes('BASIRHAT') || cleanAgency.includes('BASIRHAT')) candidates.push('BASIRHAT');
  if (cleanArea.includes('GOLABRI') || cleanAgency.includes('GOLABRI')) candidates.push('GOLABRI D/D');
  if (cleanArea.includes('HARIPAL') || cleanAgency.includes('HARIPAL')) candidates.push('HARIPAL');
  if (cleanArea.includes('MAYNA') || cleanAgency.includes('MAYNA')) candidates.push('MAYNA D/S');
  if (cleanArea.includes('ISLAMPUR') || cleanAgency.includes('ISLAMPUR')) candidates.push('S/N ISLAMPUR', 'ISLAMPUR');
  if (cleanArea.includes('SHEORAPHULLY') || cleanAgency.includes('SHEORAPHULLY')) candidates.push('SHEORAPHULLY');
  if (cleanArea.includes('MESTA') || cleanAgency.includes('MESTA')) candidates.push('GRP MESTA LOOSE', 'S/N MESTA');

  if (cleanAgency && !candidates.includes(cleanAgency)) candidates.push(cleanAgency);
  if (cleanArea && !candidates.includes(cleanArea)) candidates.push(cleanArea);

  return candidates;
}

/**
 * Fetch Base Rates directly from Supabase `satta_base_rates` table
 */
export async function fetchSattaBaseRates(): Promise<SattaBaseRate[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('satta_base_rates')
      .select('*')
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    cachedBaseRates = data || [];
    return cachedBaseRates;
  } catch (err) {
    console.error('Failed to fetch satta_base_rates from Supabase:', err);
    return cachedBaseRates;
  }
}

/**
 * Fetch latest single Base Rate from Supabase `satta_base_rates` table
 */
export async function fetchLatestSattaBaseRate(): Promise<SattaBaseRate | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('satta_base_rates')
      .select('*')
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0) ? data[0] : null;
  } catch (err) {
    console.error('Failed to fetch latest satta_base_rate from Supabase:', err);
    return null;
  }
}

/**
 * Fetch Differentials directly from Supabase `satta_differentials` table
 */
export async function fetchSattaDifferentials(): Promise<SattaDifferential[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('satta_differentials')
      .select('*')
      .order('area', { ascending: true })
      .order('grade', { ascending: true });

    if (error) throw error;
    cachedDifferentials = data || [];
    return cachedDifferentials;
  } catch (err) {
    console.error('Failed to fetch satta_differentials from Supabase:', err);
    return cachedDifferentials;
  }
}

/**
 * Fetch Calculated Rates directly from Supabase `satta_calculated_rates` table
 */
export async function fetchSattaCalculatedRates(startDate?: string): Promise<SattaCalculatedRate[]> {
  if (!supabase) return [];
  try {
    let query = supabase.from('satta_calculated_rates').select('*');
    if (startDate) {
      query = query.eq('start_date', startDate);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!startDate) {
      cachedCalculatedRates = data || [];
    }
    return data || [];
  } catch (err) {
    console.error('Failed to fetch satta_calculated_rates from Supabase:', err);
    return [];
  }
}

/**
 * Initialise / refresh central cache from Supabase
 */
export async function refreshSattaCache(): Promise<void> {
  if (!supabase) return;
  try {
    const [bases, diffs, calcs] = await Promise.all([
      fetchSattaBaseRates(),
      fetchSattaDifferentials(),
      fetchSattaCalculatedRates()
    ]);
    cachedBaseRates = bases;
    cachedDifferentials = diffs;
    cachedCalculatedRates = calcs;
    isCacheLoaded = true;
  } catch (err) {
    console.error('Error refreshing central Satta cache:', err);
  }
}

export function ensureSattaCacheLoaded(): Promise<void> {
  if (isCacheLoaded && cachedDifferentials.length > 0) {
    return Promise.resolve();
  }
  if (!cachePromise) {
    cachePromise = refreshSattaCache().finally(() => {
      cachePromise = null;
    });
  }
  return cachePromise;
}

// Module-level getters and setters
export function getCachedSattaDifferentials(): SattaDifferential[] {
  return cachedDifferentials;
}

export function setCachedSattaDifferentials(diffs: SattaDifferential[]) {
  if (Array.isArray(diffs)) {
    cachedDifferentials = diffs;
    isCacheLoaded = true;
  }
}

export function getCachedSattaBaseRates(): SattaBaseRate[] {
  return cachedBaseRates;
}

export function setCachedSattaBaseRates(bases: SattaBaseRate[]) {
  if (Array.isArray(bases)) {
    cachedBaseRates = bases;
  }
}

/**
 * Single Common Rate Resolver:
 * Given area/agency, grade, and optional date/baseRate, resolves the exact Satta Rate
 * using ONLY the Supabase database records.
 * 
 * If the rate or differential is not found in Supabase, returns found: false with a clear error.
 * ZERO hardcoded fallbacks!
 */
export function resolveSattaRate(params: {
  area?: string | null;
  agency?: string | null;
  grade?: string | null;
  date?: string | null;
  customBaseRate?: number | string | null;
  baseRates?: SattaBaseRate[];
  differentials?: SattaDifferential[];
  calculatedRates?: SattaCalculatedRate[];
}): SattaRateResult {
  const normGrade = normalizeGrade(params.grade);
  if (!normGrade) {
    return {
      found: false,
      baseRate: null,
      differential: null,
      finalRate: null,
      matchedArea: null,
      normGrade: null,
      startDate: null,
      error: 'Grade not specified'
    };
  }

  const candidateAreas = getCandidateAreas(params.area, params.agency);
  if (candidateAreas.length === 0) {
    return {
      found: false,
      baseRate: null,
      differential: null,
      finalRate: null,
      matchedArea: null,
      normGrade,
      startDate: null,
      error: 'Area or Agency not specified'
    };
  }

  const bases = (params.baseRates && params.baseRates.length > 0) ? params.baseRates : cachedBaseRates;
  const diffs = (params.differentials && params.differentials.length > 0) ? params.differentials : cachedDifferentials;
  const calcs = (params.calculatedRates && params.calculatedRates.length > 0) ? params.calculatedRates : cachedCalculatedRates;

  const targetDate = params.date || new Date().toISOString().split('T')[0];

  // 1. Determine applicable Base Rate from Supabase satta_base_rates
  let applicableBaseRate: number | null = null;
  let activeStartDate: string | null = null;

  if (params.customBaseRate !== undefined && params.customBaseRate !== null && !isNaN(Number(params.customBaseRate)) && Number(params.customBaseRate) > 0) {
    applicableBaseRate = Number(params.customBaseRate);
    activeStartDate = targetDate;
  } else if (bases && bases.length > 0) {
    const validBases = [...bases]
      .filter(b => b.start_date && b.start_date <= targetDate)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));

    const selectedBase = validBases[0] || bases[0];
    if (selectedBase && selectedBase.base_rate !== undefined && selectedBase.base_rate !== null) {
      applicableBaseRate = Number(selectedBase.base_rate);
      activeStartDate = selectedBase.start_date;
    }
  }

  if (applicableBaseRate === null || isNaN(applicableBaseRate)) {
    return {
      found: false,
      baseRate: null,
      differential: null,
      finalRate: null,
      matchedArea: null,
      normGrade,
      startDate: null,
      error: `Base rate not found in Supabase table satta_base_rates for date ${targetDate}`
    };
  }

  // 2. Check precomputed satta_calculated_rates table in Supabase
  if (calcs && calcs.length > 0 && activeStartDate) {
    for (const candArea of candidateAreas) {
      const match = calcs.find(c => {
        const cArea = String(c.area || '').trim().toUpperCase();
        const cGrade = normalizeGrade(c.grade);
        return c.start_date === activeStartDate && cArea === candArea && cGrade === normGrade;
      });

      if (match && match.final_rate !== undefined && match.final_rate !== null) {
        return {
          found: true,
          baseRate: Number(match.base_rate),
          differential: Number(match.differential),
          finalRate: Number(match.final_rate),
          matchedArea: candArea,
          normGrade,
          startDate: activeStartDate
        };
      }
    }
  }

  // 3. Look up differential in Supabase satta_differentials table
  if (diffs && diffs.length > 0) {
    for (const candArea of candidateAreas) {
      const match = diffs.find(d => {
        const dArea = String(d.area || '').trim().toUpperCase();
        const dGrade = normalizeGrade(d.grade);
        return dArea === candArea && dGrade === normGrade;
      });

      if (match && match.differential !== undefined && match.differential !== null && !isNaN(Number(match.differential))) {
        const differential = Number(match.differential);
        const finalRate = applicableBaseRate + differential;
        return {
          found: true,
          baseRate: applicableBaseRate,
          differential,
          finalRate,
          matchedArea: candArea,
          normGrade,
          startDate: activeStartDate
        };
      }
    }
  }

  const primaryArea = params.area || params.agency || 'specified area';
  return {
    found: false,
    baseRate: applicableBaseRate,
    differential: null,
    finalRate: null,
    matchedArea: null,
    normGrade,
    startDate: activeStartDate,
    error: `Rate not found in Supabase table: Differential missing for Area '${primaryArea}' and Grade '${normGrade}'`
  };
}

/**
 * Single Common Differential Resolver:
 * Given area/agency and grade, looks up the differential directly from Supabase differentials.
 */
export function resolveSattaDifferential(
  area?: string | null,
  grade?: string | null,
  agency?: string | null,
  differentialsList?: SattaDifferential[]
): SattaDiffResult {
  const normGrade = normalizeGrade(grade);
  if (!normGrade) {
    return {
      found: false,
      differential: null,
      matchedArea: null,
      normGrade: null,
      error: 'Grade not specified'
    };
  }

  const candidateAreas = getCandidateAreas(area, agency);
  if (candidateAreas.length === 0) {
    return {
      found: false,
      differential: null,
      matchedArea: null,
      normGrade,
      error: 'Area or Agency not specified'
    };
  }

  const diffs = (differentialsList && differentialsList.length > 0) ? differentialsList : cachedDifferentials;

  if (diffs && diffs.length > 0) {
    for (const candArea of candidateAreas) {
      const match = diffs.find(d => {
        const dArea = String(d.area || '').trim().toUpperCase();
        const dGrade = normalizeGrade(d.grade);
        return dArea === candArea && dGrade === normGrade;
      });

      if (match && match.differential !== undefined && match.differential !== null && !isNaN(Number(match.differential))) {
        return {
          found: true,
          differential: Number(match.differential),
          matchedArea: candArea,
          normGrade
        };
      }
    }
  }

  const primaryArea = area || agency || 'specified area';
  return {
    found: false,
    differential: null,
    matchedArea: null,
    normGrade,
    error: `Rate not found in Supabase: Differential missing for Area '${primaryArea}' and Grade '${normGrade}'`
  };
}

/**
 * Fetch a single Satta Rate asynchronously from Supabase
 */
export async function fetchSingleSattaRate(params: {
  area?: string | null;
  agency?: string | null;
  grade: string;
  date?: string | null;
  customBaseRate?: number | string | null;
}): Promise<SattaRateResult> {
  await ensureSattaCacheLoaded();
  return resolveSattaRate(params);
}

// Auto-initialize cache when module is imported in browser
if (typeof window !== 'undefined') {
  ensureSattaCacheLoaded().catch(() => {});

  window.addEventListener('satta-chart-uploaded', () => {
    refreshSattaCache().catch(() => {});
  });
  window.addEventListener('base-rate-updated', () => {
    refreshSattaCache().catch(() => {});
  });
}
