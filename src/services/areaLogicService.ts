import { supabase } from '../lib/supabase';
import { AREA_LOGIC_MASTER_DATA, AreaLogicRecord } from '../data/areaLogicMasterData';

let inMemoryAreaLogic: AreaLogicRecord[] = [...AREA_LOGIC_MASTER_DATA];
let isLoadedFromSupabase = false;

/**
 * Fetch Area-Agency mapping records from Supabase area_logic table.
 * Falls back seamlessly to AREA_LOGIC_MASTER_DATA if the table is empty or unavailable.
 */
export async function fetchAreaLogic(): Promise<AreaLogicRecord[]> {
  if (!supabase) return inMemoryAreaLogic;

  try {
    const allRecords: AreaLogicRecord[] = [];
    let page = 0;
    const pageSize = 500;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('area_logic')
        .select('AREA_CODE, AREA_NAME, AGENCY_CODE, AGENCY_NAME')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('AGENCY_CODE', { ascending: true });

      if (error || !data || data.length === 0) {
        hasMore = false;
        if (error && page === 0) {
          console.warn('[areaLogicService] area_logic table query returned notice/error, using bundled master mapping:', error.message);
          // Try auto-seeding if table exists but needs data
          seedAreaLogicToSupabase().catch(() => {});
        }
      } else {
        data.forEach((r: any) => {
          allRecords.push({
            AREA_CODE: String(r.AREA_CODE || r.area_code || '').trim(),
            AREA_NAME: String(r.AREA_NAME || r.area_name || '').trim(),
            AGENCY_CODE: String(r.AGENCY_CODE || r.agency_code || '').trim(),
            AGENCY_NAME: String(r.AGENCY_NAME || r.agency_name || '').trim()
          });
        });

        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    if (allRecords.length > 0) {
      inMemoryAreaLogic = allRecords;
      isLoadedFromSupabase = true;
      console.log(`[areaLogicService] Successfully loaded ${allRecords.length} Area-Agency mappings from Supabase area_logic table.`);
    }
  } catch (err) {
    console.warn('[areaLogicService] Failed to query Supabase area_logic table, using bundled master data:', err);
  }

  return inMemoryAreaLogic;
}

/**
 * Seeds bundled Area-Agency master mappings to Supabase area_logic table if empty or missing.
 */
export async function seedAreaLogicToSupabase(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data: existing, error: checkErr } = await supabase
      .from('area_logic')
      .select('id')
      .limit(1);

    if (checkErr) {
      console.warn('[areaLogicService] Cannot seed: area_logic table may not exist yet in Supabase schema.');
      return false;
    }

    if (existing && existing.length > 0) {
      // Table already populated
      return true;
    }

    console.log('[areaLogicService] Seeding 657 Area-Agency records into Supabase area_logic table...');
    const batchSize = 100;
    for (let i = 0; i < AREA_LOGIC_MASTER_DATA.length; i += batchSize) {
      const batch = AREA_LOGIC_MASTER_DATA.slice(i, i + batchSize);
      const { error: insertErr } = await supabase
        .from('area_logic')
        .upsert(batch, { onConflict: 'AREA_CODE,AGENCY_CODE' });

      if (insertErr) {
        console.error('[areaLogicService] Error inserting batch into area_logic:', insertErr.message);
      }
    }
    console.log('[areaLogicService] Seeding completed successfully.');
    return true;
  } catch (err) {
    console.error('[areaLogicService] Seeding error:', err);
    return false;
  }
}

export interface MappedAgency {
  AREA_CODE: string;
  AREA_NAME: string;
  AGENCY_CODE: string;
  AGENCY_NAME: string;
  agency_code: string;
  agency_name: string;
  id: string;
  name: string;
}

/**
 * Main Dropdown Functionality:
 * Retrieves ALL and ONLY agencies mapped to the given AREA_CODE or AREA_NAME.
 *
 * Rules:
 * - Empty area => returns []
 * - Does not merge duplicate agency names if agency codes differ
 * - Includes records named "No agency"
 * - Returns normalized agency objects
 */
export function getAgenciesForArea(selectedAreaCodeOrName: string | null | undefined): MappedAgency[] {
  if (!selectedAreaCodeOrName) return [];

  const searchTarget = String(selectedAreaCodeOrName).trim().toUpperCase();
  if (!searchTarget) return [];

  // Filter inMemoryAreaLogic by AREA_CODE or AREA_NAME
  const filtered = inMemoryAreaLogic.filter(r => {
    const codeMatch = String(r.AREA_CODE || '').trim().toUpperCase() === searchTarget;
    const nameMatch = String(r.AREA_NAME || '').trim().toUpperCase() === searchTarget;
    return codeMatch || nameMatch;
  });

  // Map to unified object supporting both uppercase & lowercase property names
  return filtered.map(r => {
    const agencyCode = String(r.AGENCY_CODE || '').trim();
    const agencyName = String(r.AGENCY_NAME || '').trim();
    const areaCode = String(r.AREA_CODE || '').trim();
    const areaName = String(r.AREA_NAME || '').trim();

    return {
      AREA_CODE: areaCode,
      AREA_NAME: areaName,
      AGENCY_CODE: agencyCode,
      AGENCY_NAME: agencyName,
      agency_code: agencyCode,
      agency_name: agencyName,
      id: `${areaCode}-${agencyCode}`,
      name: agencyName
    };
  });
}

/**
 * Validates whether an AREA_CODE / AREA_NAME and AGENCY_CODE / AGENCY_NAME combination exists in area_logic.
 */
export function validateAreaAgencyCombination(
  areaCodeOrName: string | null | undefined,
  agencyCodeOrName: string | null | undefined
): { isValid: boolean; message?: string } {
  if (!areaCodeOrName || !agencyCodeOrName) {
    return { isValid: true }; // allow blank if optional
  }

  const normArea = String(areaCodeOrName).trim().toUpperCase();
  const normAgency = String(agencyCodeOrName).trim().toUpperCase();

  const mappedAgencies = getAgenciesForArea(normArea);
  if (mappedAgencies.length === 0) {
    return {
      isValid: false,
      message: `No Agencies mapped for Area "${areaCodeOrName}" in area_logic table.`
    };
  }

  const match = mappedAgencies.some(a => 
    a.AGENCY_CODE.toUpperCase() === normAgency ||
    a.AGENCY_NAME.toUpperCase() === normAgency ||
    a.agency_code.toUpperCase() === normAgency ||
    a.agency_name.toUpperCase() === normAgency
  );

  if (!match) {
    return {
      isValid: false,
      message: `Agency "${agencyCodeOrName}" is NOT mapped to Area "${areaCodeOrName}". Please select an agency from the Area's mapped dropdown.`
    };
  }

  return { isValid: true };
}

// Initial async fetch on load
fetchAreaLogic().catch(() => {});
