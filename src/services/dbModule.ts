import { supabase } from "../lib/supabase";
import { notifyDataChanged } from "../hooks/useLiveAutoRefresh";
import { logChange } from "./auditLogService";

function getModuleFromTable(table: string): string {
  const map: Record<string, string> = {
    user_master: "User Master",
    sauda_master: "Sauda Entry",
    satta_master: "Satta Desk",
    sauda_quality_details: "Sauda Quality",
    satta_base_rates: "Satta Desk",
    satta_differentials: "Satta Desk",
    satta_calculated_rates: "Satta Desk",
    temporary_material_received: "Temporary Arrival",
    final_arrival: "Final Arrival",
    material_received: "Material Received",
    purchase_master: "Final P.O.",
    sauda_check_point: "Sauda Check Point",
    sauda_check_point_details: "Sauda Check Point Details",
    sauda_check_point_deductions: "Sauda Check Point Deductions",
    material_inspection: "Mill Inspection",
    mill_inspection_master: "Mill Inspection",
    payment_master: "Payment Master",
    payment_details: "Payment Details",
    broker_master: "Broker Master",
    supply_master: "Supplier Master",
    godown_master: "Godown Master",
    material_mismatch: "Mismatch Section",
    satta_mismatch: "Satta Mismatch",
    settlement_master: "settlement master"
  };
  return map[table] || table.replace(/_/g, ' ').toUpperCase();
}

function getRecordIdFromData(data: any): string {
  if (!data || typeof data !== 'object') return 'RECORD';
  return (
    data.po_no ||
    data.mr_no ||
    data.user_id ||
    data.sauda_no ||
    data.arrival_no ||
    data.final_arrival_no ||
    data.temporary_arrival_no ||
    data.voucher_no ||
    data.mismatch_id ||
    data.start_date ||
    data.id ||
    data.username ||
    'RECORD'
  );
}

export type EntityType = 
  | 'user_master' 
  | 'sauda_master' 
  | 'satta_master' 
  | 'sauda_quality_details'
  | 'satta_quality_details'
  | 'satta_base_rates'
  | 'satta_differentials'
  | 'satta_calculated_rates'
  | 'material_received'
  | 'temporary_material_received'
  | 'final_arrival'
  | 'purchase_master' 
  | 'sauda_check_point'
  | 'sauda_check_point_details'
  | 'sauda_check_point_deductions'
  | 'mill_inspection_deduction'
  | 'material_inspection_deductions'
  | 'temporary_po'
  | 'temporary_po_details'
  | 'godown_master'
  | 'broker_master'
  | 'supply_master'
  | 'opening_stock'
  | 'closing_stock'
  | 'batch_master'
  | 'unit_master'
  | 'lorry_weighments'
  | 'payment_master'
  | 'payment_details'
  | 'mr_settlement_master'
  | 'mr_settlement_detail'
  | 'm_r_settlement'
  | 'mr_settlement_master';

function extractMissingColumn(msg?: string): string | null {
  if (!msg) return null;
  const match = msg.match(/Could not find the '([^']+)' column/i) ||
                msg.match(/column "([^"]+)" of relation/i) ||
                msg.match(/column "([^"]+)" does not exist/i) ||
                msg.match(/column '([^']+)' does not exist/i) ||
                msg.match(/column "([^"]+)"/i);
  return match ? match[1] : null;
}

// High-Performance In-Memory Master Cache with automatic TTL and write-invalidation
const masterTableCache = new Map<string, { timestamp: number; data: any[] }>();
const CACHE_TTL_MS = 60000; // 60 seconds
const CACHED_MASTER_TABLES = new Set([
  'broker_master',
  'supply_master',
  'area_master',
  'agency_master',
  'grade_master',
  'marka_master',
  'godown_master',
  'unit_master',
  'batch_master',
  'department_master'
]);

function invalidateMasterCache(table: string) {
  const norm = table.toLowerCase();
  if (CACHED_MASTER_TABLES.has(norm)) {
    masterTableCache.delete(norm);
  }
}

export const dbModule = {
  async fetchAll(table: string, orderCol?: string, ascending: boolean = true, limit?: number): Promise<any[]> {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    const norm = table.toLowerCase();
    
    // Check in-memory master cache for static/semi-static master tables
    if (!limit && !orderCol && CACHED_MASTER_TABLES.has(norm)) {
      const cached = masterTableCache.get(norm);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    let query = supabase.from(table).select("*");
    if (orderCol) query = query.order(orderCol, { ascending });
    if (limit) query = query.limit(limit);
    
    const { data, error } = await query;
    if (error) throw error;
    const result = data || [];

    if (!limit && !orderCol && CACHED_MASTER_TABLES.has(norm)) {
      masterTableCache.set(norm, { timestamp: Date.now(), data: result });
    }

    return result;
  },

  async insert(table: string, data: any) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    invalidateMasterCache(table);
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'insert', table, data });
      notifyDataChanged(table);
      return data;
    }
    let payload = { ...data };
    for (let attempt = 0; attempt < 25; attempt++) {
      const { data: resultRows, error } = await supabase
        .from(table)
        .insert(payload)
        .select();
      
      const result = Array.isArray(resultRows) ? resultRows[0] : resultRows;

      if (error) {
        // 1. Check if an empty string caused a type mismatch error
        if (error.message && (error.message.includes('invalid input syntax for type') || error.message.includes('invalid input syntax for integer') || error.message.includes('invalid input syntax for date') || error.message.includes('invalid input syntax for numeric'))) {
          let converted = false;
          Object.keys(payload).forEach(k => {
            if (payload[k] === '') {
              payload[k] = null;
              converted = true;
            }
          });
          if (converted) {
            continue;
          }
        }

        const col = extractMissingColumn(error.message);
        if (col && col in payload) {
          delete payload[col];
          continue;
        }
        throw error;
      }
      notifyDataChanged(table);
      logChange({
        module: getModuleFromTable(table),
        entity_name: getModuleFromTable(table),
        record_id: getRecordIdFromData(result || payload),
        action: 'CREATE',
        field_name: 'record',
        field_label: `${getModuleFromTable(table)} Record`,
        old_value: 'None',
        new_value: 'Created',
        remarks: `New record created in ${getModuleFromTable(table)}`
      }).catch(() => {});
      return result || payload;
    }
    return payload;
  },

  async upsert(table: string, data: any, idCol?: string) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    invalidateMasterCache(table);
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'insert', table, data });
      notifyDataChanged(table);
      logChange({
        module: getModuleFromTable(table),
        entity_name: getModuleFromTable(table),
        record_id: getRecordIdFromData(data),
        action: 'UPDATE',
        field_name: 'record',
        field_label: `${getModuleFromTable(table)} Record`,
        old_value: 'Previous State',
        new_value: 'Saved (Offline)',
        remarks: `Record saved offline in ${getModuleFromTable(table)}`
      }).catch(() => {});
      return data;
    }
    let payload = { ...data };
    for (let attempt = 0; attempt < 25; attempt++) {
      const { data: resultRows, error } = await supabase
        .from(table)
        .upsert(payload, idCol ? { onConflict: idCol } : undefined)
        .select();
      
      const result = Array.isArray(resultRows) ? resultRows[0] : resultRows;

      if (error) {
        // Fallback if table lacks a UNIQUE constraint on idCol (Postgres 42P10)
        if (idCol && payload[idCol] !== undefined && error.message && (
          error.message.includes('no unique or exclusion constraint') ||
          error.code === '42P10'
        )) {
          const { data: existingRows } = await supabase
            .from(table)
            .select(idCol)
            .eq(idCol, payload[idCol])
            .limit(1);
          if (existingRows && existingRows.length > 0) {
            return await this.update(table, idCol, payload[idCol], payload);
          } else {
            return await this.insert(table, payload);
          }
        }

        if (error.message && (error.message.includes('invalid input syntax for type') || error.message.includes('invalid input syntax for integer') || error.message.includes('invalid input syntax for date') || error.message.includes('invalid input syntax for numeric'))) {
          let converted = false;
          Object.keys(payload).forEach(k => {
            if (payload[k] === '') {
              payload[k] = null;
              converted = true;
            }
          });
          if (converted) {
            continue;
          }
        }

        const col = extractMissingColumn(error.message);
        if (col && col in payload) {
          delete payload[col];
          continue;
        }
        throw error;
      }
      notifyDataChanged(table);
      logChange({
        module: getModuleFromTable(table),
        entity_name: getModuleFromTable(table),
        record_id: getRecordIdFromData(result || payload),
        action: 'UPDATE',
        field_name: 'record',
        field_label: `${getModuleFromTable(table)} Record`,
        old_value: 'Previous State',
        new_value: 'Saved / Updated',
        remarks: `Record saved/upserted in ${getModuleFromTable(table)}`
      }).catch(() => {});
      return result || payload;
    }
    return payload;
  },

  async update(table: string, idCol: string, idVal: any, data: any) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    invalidateMasterCache(table);
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'update', table, idCol, idVal, data });
      notifyDataChanged(table);
      logChange({
        module: getModuleFromTable(table),
        entity_name: getModuleFromTable(table),
        record_id: String(idVal || 'RECORD'),
        action: 'UPDATE',
        field_name: 'record',
        field_label: `${getModuleFromTable(table)} Record`,
        old_value: 'Previous State',
        new_value: 'Updated (Offline)',
        remarks: `Record updated offline in ${getModuleFromTable(table)}`
      }).catch(() => {});
      return data;
    }
    let payload = { ...data };
    for (let attempt = 0; attempt < 25; attempt++) {
      if (Object.keys(payload).length === 0) {
        return data;
      }
      const { data: resultRows, error } = await supabase
        .from(table)
        .update(payload)
        .eq(idCol, idVal)
        .select();
      
      const result = Array.isArray(resultRows) ? resultRows[0] : resultRows;

      if (error) {
        if (error.message && (error.message.includes('invalid input syntax for type') || error.message.includes('invalid input syntax for integer') || error.message.includes('invalid input syntax for date') || error.message.includes('invalid input syntax for numeric'))) {
          let converted = false;
          Object.keys(payload).forEach(k => {
            if (payload[k] === '') {
              payload[k] = null;
              converted = true;
            }
          });
          if (converted) {
            continue;
          }
        }

        const col = extractMissingColumn(error.message);
        if (col && col in payload) {
          delete payload[col];
          continue;
        }
        throw error;
      }
      notifyDataChanged(table);
      logChange({
        module: getModuleFromTable(table),
        entity_name: getModuleFromTable(table),
        record_id: getRecordIdFromData(result || payload) !== 'RECORD' ? getRecordIdFromData(result || payload) : String(idVal || 'RECORD'),
        action: 'UPDATE',
        field_name: 'record',
        field_label: `${getModuleFromTable(table)} Record`,
        old_value: 'Previous State',
        new_value: 'Updated',
        remarks: `Record updated in ${getModuleFromTable(table)}`
      }).catch(() => {});
      return result || payload;
    }
    return payload;
  },

  async delete(table: string, idCol: string, idVal: any) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    invalidateMasterCache(table);
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'delete', table, idCol, idVal });
      notifyDataChanged(table);
      logChange({
        module: getModuleFromTable(table),
        entity_name: getModuleFromTable(table),
        record_id: String(idVal || 'RECORD'),
        action: 'DELETE',
        field_name: 'record',
        field_label: `${getModuleFromTable(table)} Record`,
        old_value: 'Active',
        new_value: 'Deleted',
        remarks: `Record deleted from ${getModuleFromTable(table)}`
      }).catch(() => {});
      return true;
    }
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(idCol, idVal);
    
    if (error) throw error;
    notifyDataChanged(table);
    logChange({
      module: getModuleFromTable(table),
      entity_name: getModuleFromTable(table),
      record_id: String(idVal || 'RECORD'),
      action: 'DELETE',
      field_name: 'record',
      field_label: `${getModuleFromTable(table)} Record`,
      old_value: 'Active',
      new_value: 'Deleted',
      remarks: `Record deleted from ${getModuleFromTable(table)}`
    }).catch(() => {});
    return true;
  }
};

// --- In-Memory Offline Background Sync Worker ---
interface OfflineAction {
  action: 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  idCol?: string;
  idVal?: any;
  timestamp?: number;
}

let inMemoryOfflineQueue: OfflineAction[] = [];

function queueOfflineAction(action: OfflineAction) {
  inMemoryOfflineQueue.push({ ...action, timestamp: Date.now() });
}

export async function flushOfflineQueue() {
  const queue = [...inMemoryOfflineQueue];
  if (queue.length === 0) return;

  const failedQueue: OfflineAction[] = [];

  for (const item of queue) {
    try {
      if (item.action === 'insert') {
        await dbModule.insert(item.table, item.data);
      } else if (item.action === 'update' && item.idCol && item.idVal) {
        await dbModule.update(item.table, item.idCol, item.idVal, item.data);
      } else if (item.action === 'delete' && item.idCol && item.idVal) {
        await dbModule.delete(item.table, item.idCol, item.idVal);
      }
    } catch (e) {
      console.error(`[SYNC] Failed to process queued action for ${item.table}:`, e);
      failedQueue.push(item);
    }
  }

  inMemoryOfflineQueue = failedQueue;
}

// Auto-flush when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineQueue();
  });
}
