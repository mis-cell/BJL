import { supabase } from '../lib/supabase';
import { dbModule } from './dbModule';
import { PoItemRow } from '../types/purchaseOrder';

export const poService = {
  /**
   * Fetch detail items directly from Supabase ordered strictly by srl_no, with fallback to dbModule
   */
  async fetchPoDetails(detailTable: string, poNo: string): Promise<PoItemRow[]> {
    const poNoClean = String(poNo || '').trim();
    const poNoUpper = poNoClean.toUpperCase();

    let details: any[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from(detailTable)
          .select('*')
          .ilike('po_no', poNoClean)
          .order('srl_no', { ascending: true });
        if (!error && data && data.length > 0) {
          details = data;
        }
      } catch (err) {
        console.warn(`Direct fetch from ${detailTable} failed:`, err);
      }
    }

    if (!details || details.length === 0) {
      const allLocal = await dbModule.fetchAll(detailTable).catch(() => []);
      details = (allLocal || [])
        .filter((d: any) => String(d.po_no || '').trim().toUpperCase() === poNoUpper)
        .sort((a: any, b: any) => (Number(a.srl_no || a.srl || 0) - Number(b.srl_no || b.srl || 0)));
    }

    return details.map((d: any, idx: number) => ({
      srl: Number(d.srl_no || d.srl || idx + 1),
      crop: String(d.crop_year || d.crop || '2026-27'),
      grade_code: String(d.grade_code || d.quality || ''),
      grade_name: String(d.grade_name || d.quality || d.grade_code || ''),
      agency_code: String(d.agency_code || d.agency || ''),
      agency_name: String(d.agency_name || d.agency || d.agency_code || ''),
      marka_code: String(d.marka_code || d.marka || ''),
      marka_name: String(d.marka_name || d.marka || d.marka_code || ''),
      qty: Number(d.quantity || d.qty || 0),
      weight: Number(d.weight_mt || d.weight || 0),
      rate: Number(d.rate_qntl || d.rate || d.rs || 0),
      premium: Number(d.premium || 0)
    }));
  },

  /**
   * Batch persist PO detail rows cleanly into both Supabase and dbModule
   */
  async savePoDetails(
    detailTable: string, 
    poNo: string, 
    items: any[], 
    lookupLists?: { gradeList?: any[]; agencyList?: any[]; markaList?: any[] }
  ): Promise<void> {
    const finalPoNo = String(poNo || '').trim();
    if (!finalPoNo) return;
    
    // 1. Clear old detail rows from Supabase (both exact and case-insensitive)
    if (supabase) {
      try {
        await supabase.from(detailTable).delete().eq('po_no', finalPoNo);
        await supabase.from(detailTable).delete().ilike('po_no', finalPoNo);
      } catch (e) {
        console.warn(`Failed to delete from ${detailTable}:`, e);
      }
    }
    await dbModule.delete(detailTable, 'po_no', finalPoNo).catch(() => {});

    if (!items || items.length === 0) return;

    const grades = lookupLists?.gradeList || [];
    const agencies = lookupLists?.agencyList || [];
    const markas = lookupLists?.markaList || [];

    const itemsToInsert: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && (item.grade_code || item.grade_name || item.agency_code || item.agency_name || item.marka_code || item.marka_name || Number(item.qty) > 0 || Number(item.weight) > 0 || Number(item.rate) > 0 || Number(item.premium) > 0)) {
        const rawG = String(item.grade_code || item.grade_name || '').trim();
        const rawA = String(item.agency_code || item.agency_name || '').trim();
        const rawM = String(item.marka_code || item.marka_name || '').trim();

        const gMatch = grades.find((g: any) => g.grade_code === rawG || g.grade_name?.trim().toUpperCase() === rawG.toUpperCase());
        const aMatch = agencies.find((a: any) => a.agency_code === rawA || a.agency_name?.trim().toUpperCase() === rawA.toUpperCase());
        const mMatch = markas.find((m: any) => m.marka_code === rawM || m.marka_name?.trim().toUpperCase() === rawM.toUpperCase());

        const gCode = gMatch ? gMatch.grade_code : String(item.grade_code || rawG).trim();
        const gName = gMatch ? gMatch.grade_name : String(item.grade_name || rawG).trim();
        const aCode = aMatch ? aMatch.agency_code : String(item.agency_code || rawA).trim();
        const aName = aMatch ? aMatch.agency_name : String(item.agency_name || rawA).trim();
        const mCode = mMatch ? mMatch.marka_code : String(item.marka_code || rawM).trim();
        const mName = mMatch ? mMatch.marka_name : String(item.marka_name || rawM).trim();

        const detailRow = {
          po_no: finalPoNo,
          srl_no: i + 1,
          crop_year: String(item.crop || '2026-27'),
          grade_code: gCode,
          grade_name: gName,
          agency_code: aCode,
          agency_name: aName,
          marka_code: mCode,
          marka_name: mName,
          quantity: Math.round(Number(item.qty || 0)) || 0,
          weight_mt: Number(Number(item.weight || 0).toFixed(3)) || 0,
          rate_qntl: Number(Number(item.rate || 0).toFixed(2)) || 0,
          premium: Number(Number(item.premium || 0).toFixed(2)) || 0
        };
        itemsToInsert.push(detailRow);
      }
    }

    if (itemsToInsert.length === 0) return;

    if (supabase) {
      const { error: batchErr } = await supabase.from(detailTable).insert(itemsToInsert);
      if (batchErr) {
        console.warn(`Batch insert on ${detailTable} failed, attempting sanitized insert:`, batchErr);
        const coreItems = itemsToInsert.map(row => ({
          po_no: row.po_no,
          srl_no: row.srl_no,
          crop_year: row.crop_year,
          grade_code: row.grade_code,
          agency_code: row.agency_code,
          marka_code: row.marka_code,
          quantity: row.quantity,
          weight_mt: row.weight_mt,
          rate_qntl: row.rate_qntl,
          premium: row.premium
        }));
        const { error: retryErr } = await supabase.from(detailTable).insert(coreItems);
        if (retryErr) {
          console.error(`Sanitized insert on ${detailTable} failed:`, retryErr);
          throw new Error(`Database error saving detail rows: ${retryErr.message}`);
        }
      }
    }

    for (const row of itemsToInsert) {
      await dbModule.insert(detailTable, row).catch(() => {});
    }
  }
};
