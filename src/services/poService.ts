import { supabase } from '../lib/supabaseClient';
import dbModule from '../lib/db';
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
        const { data } = await supabase
          .from(detailTable)
          .select('*')
          .ilike('po_no', poNoClean)
          .order('srl_no', { ascending: true });
        if (data && data.length > 0) {
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
      rate: Number(d.rate_qntl || d.rate || 0),
      premium: Number(d.premium || 0)
    }));
  },

  /**
   * Batch persist PO detail rows cleanly into both Supabase and dbModule
   */
  async savePoDetails(detailTable: string, poNo: string, items: PoItemRow[]): Promise<void> {
    const finalPoNo = String(poNo).trim();
    
    // Clear old detail rows first
    if (supabase) {
      try {
        await supabase.from(detailTable).delete().eq('po_no', finalPoNo);
      } catch (e) {
        console.warn(`Failed to delete from ${detailTable}:`, e);
      }
    }
    await dbModule.delete(detailTable, 'po_no', finalPoNo).catch(() => {});

    if (!items || items.length === 0) return;

    const itemsToInsert: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.grade_code || item.marka_code || item.grade_name || item.qty || item.weight) {
        const detailRow = {
          po_no: finalPoNo,
          srl_no: i + 1,
          crop_year: String(item.crop || '2026-27'),
          grade_code: String(item.grade_code || item.grade_name || '').trim(),
          grade_name: String(item.grade_name || item.grade_code || '').trim(),
          agency_code: String(item.agency_code || item.agency_name || '').trim(),
          agency_name: String(item.agency_name || item.agency_code || '').trim(),
          marka_code: String(item.marka_code || item.marka_name || '').trim(),
          marka_name: String(item.marka_name || item.marka_code || '').trim(),
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
      try {
        await supabase.from(detailTable).insert(itemsToInsert);
      } catch (batchErr) {
        console.warn(`Batch insert on ${detailTable} failed, inserting individually:`, batchErr);
        for (const row of itemsToInsert) {
          await supabase.from(detailTable).insert(row).catch(() => {});
        }
      }
    }

    for (const row of itemsToInsert) {
      await dbModule.insert(detailTable, row).catch(() => {});
    }
  }
};
