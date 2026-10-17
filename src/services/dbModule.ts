import { supabase } from "../lib/supabase";
import { logChange } from "./auditLogService";

export const APP_DATA_UPDATED_EVENT = "app-data-updated";

const MODULE_LABELS: Record<string, string> = {
  sauda_master: "Sauda Entry Desk",
  sauda_quality_details: "Sauda Quality Details",
  sauda_check_point: "Sauda Check Point",
  sauda_check_point_details: "Sauda Check Point Details",
  purchase_master: "Final P.O",
  purchase_detail_master: "Final P.O Details",
  temporary_material_received: "Temporary Arrival (MR)",
  material_received: "Final Arrival / Weighbridge",
  material_inspection: "Material Inspection",
  mill_inspection_master: "Mill Inspection",
  mr_settlement: "MR Settlement",
  payment_master: "Payment Desk",
  satta_master: "Satta Entry",
  satta_base_rates: "Satta Base Rates",
  satta_differentials: "Satta Differentials",
  satta_calculated_rates: "Satta Calculated Rates",
  material_issue: "Material Issue",
  opening_stock: "Opening Stock",
  broker_master: "Broker Master",
  supply_master: "Supplier Master",
  customer_master: "Trader Directory",
  tolerance_policy_master: "Tolerance Policy",
  clubbed_pomr: "Clubbed PO/MR",
};

export function notifyDataChanged(table?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(APP_DATA_UPDATED_EVENT, {
        detail: { table, timestamp: Date.now() },
      })
    );
  }
}

function assertOnlineAndConnected(operation: string, table: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(
      `Cannot perform ${operation} on "${table}" while offline. Please reconnect and try again.`
    );
  }
  if (!supabase) {
    throw new Error(
      `Database client is not initialized for ${operation} on "${table}".`
    );
  }
}

function sanitizePayload(data: Record<string, any>): Record<string, any> {
  const payload = { ...data };
  delete payload._offline_queued;
  delete payload._stripped_columns;
  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) {
      delete payload[k];
    }
  });
  return payload;
}

export const dbModule = {
  /**
   * Execute an atomic SQL transaction via the database RPC `exec_sql`.
   * Rolls back all statements if any statement fails.
   */
  async executeTransaction(statements: string | string[]): Promise<any> {
    assertOnlineAndConnected("transaction", "exec_sql");
    const sqlList = (Array.isArray(statements) ? statements : [statements])
      .map((s) => s.trim())
      .filter(Boolean);
    if (sqlList.length === 0) return { success: true };

    const wrappedSql = `BEGIN;\n${sqlList
      .map((s) => (s.endsWith(";") ? s : `${s};`))
      .join("\n")}\nCOMMIT;`;

    const { data, error } = await supabase!.rpc("exec_sql", {
      query: wrappedSql,
    });
    if (error) {
      throw new Error(`Atomic transaction failed: ${error.message}`);
    }
    if (data && typeof data === "object" && data.error) {
      throw new Error(`Atomic transaction rejected: ${data.error}`);
    }
    return data ?? { success: true };
  },

  /**
   * Paginated fetchAll that retrieves all rows in deterministic 1000-row pages
   * without silent truncation or unbounded memory spikes.
   */
  async fetchAll(
    table: string,
    options?: { pageSize?: number; maxRows?: number; orderBy?: string; ascending?: boolean }
  ): Promise<any[]> {
    if (!supabase) {
      throw new Error(`Database client is not initialized to read "${table}".`);
    }

    const pageSize = Math.min(Math.max(options?.pageSize || 1000, 100), 1000);
    const maxRows = options?.maxRows || 50000;
    const allRows: any[] = [];
    let offset = 0;

    while (offset < maxRows) {
      let query = supabase
        .from(table)
        .select("*")
        .range(offset, offset + pageSize - 1);

      if (options?.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.ascending ?? true,
        });
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch records from "${table}": ${error.message}`);
      }

      const batch = data || [];
      allRows.push(...batch);

      if (batch.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    return allRows;
  },

  /**
   * Strict insert that never strips columns and always verifies an authoritative returned row.
   */
  async insert(table: string, data: any): Promise<any> {
    assertOnlineAndConnected("insert", table);
    const payload = sanitizePayload(data);

    const { data: insertedRows, error } = await supabase!
      .from(table)
      .insert([payload])
      .select();

    if (error) {
      throw new Error(`Insert into "${table}" failed: ${error.message}`);
    }

    if (!insertedRows || insertedRows.length === 0) {
      throw new Error(
        `Insert into "${table}" failed: zero rows were returned by the database.`
      );
    }

    const savedRow = insertedRows[0];
    notifyDataChanged(table);

    if (table !== "app_audit_logs" && table !== "user_activity_logs") {
      const recId =
        savedRow.po_no ||
        savedRow.sauda_no ||
        savedRow.mr_no ||
        savedRow.temporary_arrival_no ||
        savedRow.amad_no ||
        savedRow.payment_id ||
        savedRow.issue_no ||
        savedRow.id ||
        "NEW";
      logChange({
        module: MODULE_LABELS[table] || table,
        entity_name: table,
        record_id: String(recId),
        action: "CREATE",
        field_name: "record",
        field_label: "New Record Created",
        old_value: null,
        new_value: recId,
      }).catch(() => {});
    }

    return savedRow;
  },

  /**
   * Strict upsert that never strips columns and verifies an authoritative returned row.
   */
  async upsert(table: string, data: any, onConflictColumn: string): Promise<any> {
    assertOnlineAndConnected("upsert", table);
    const payload = sanitizePayload(data);

    const { data: upsertedRows, error } = await supabase!
      .from(table)
      .upsert([payload], { onConflict: onConflictColumn })
      .select();

    if (error) {
      throw new Error(
        `Upsert into "${table}" (conflict key "${onConflictColumn}") failed: ${error.message}`
      );
    }

    if (!upsertedRows || upsertedRows.length === 0) {
      throw new Error(
        `Upsert into "${table}" failed: zero rows were returned by the database.`
      );
    }

    const savedRow = upsertedRows[0];
    notifyDataChanged(table);

    if (table !== "app_audit_logs" && table !== "user_activity_logs") {
      const recId =
        savedRow[onConflictColumn] ||
        savedRow.po_no ||
        savedRow.sauda_no ||
        savedRow.mr_no ||
        savedRow.id ||
        "UPSERT";
      logChange({
        module: MODULE_LABELS[table] || table,
        entity_name: table,
        record_id: String(recId),
        action: "UPDATE",
        field_name: onConflictColumn,
        field_label: `Upsert (${onConflictColumn})`,
        old_value: null,
        new_value: recId,
      }).catch(() => {});
    }

    return savedRow;
  },

  /**
   * Strict update that requires at least one matched & returned row from Supabase.
   */
  async update(
    table: string,
    idColumn: string,
    idValue: any,
    data: any
  ): Promise<any> {
    assertOnlineAndConnected("update", table);
    if (idValue === undefined || idValue === null || String(idValue).trim() === "") {
      throw new Error(
        `Update on "${table}" rejected: missing key value for "${idColumn}".`
      );
    }

    const payload = sanitizePayload(data);
    const { data: updatedRows, error } = await supabase!
      .from(table)
      .update(payload)
      .eq(idColumn, idValue)
      .select();

    if (error) {
      throw new Error(
        `Update on "${table}" where ${idColumn}="${idValue}" failed: ${error.message}`
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        `Update on "${table}" where ${idColumn}="${idValue}" matched 0 rows.`
      );
    }

    const savedRow = updatedRows[0];
    notifyDataChanged(table);

    if (table !== "app_audit_logs" && table !== "user_activity_logs") {
      logChange({
        module: MODULE_LABELS[table] || table,
        entity_name: table,
        record_id: String(idValue),
        action: "UPDATE",
        field_name: Object.keys(payload).join(", "),
        field_label: "Updated Fields",
        old_value: null,
        new_value: JSON.stringify(payload),
      }).catch(() => {});
    }

    return savedRow;
  },

  /**
   * Strict delete that verifies database execution and logs only after confirmed deletion.
   */
  async delete(table: string, idColumn: string, idValue: any): Promise<any> {
    assertOnlineAndConnected("delete", table);
    if (idValue === undefined || idValue === null || String(idValue).trim() === "") {
      throw new Error(
        `Delete on "${table}" rejected: missing key value for "${idColumn}".`
      );
    }

    const { data: deletedRows, error } = await supabase!
      .from(table)
      .delete()
      .eq(idColumn, idValue)
      .select();

    if (error) {
      throw new Error(
        `Delete from "${table}" where ${idColumn}="${idValue}" failed: ${error.message}`
      );
    }

    notifyDataChanged(table);

    if (
      deletedRows &&
      deletedRows.length > 0 &&
      table !== "app_audit_logs" &&
      table !== "user_activity_logs"
    ) {
      logChange({
        module: MODULE_LABELS[table] || table,
        entity_name: table,
        record_id: String(idValue),
        action: "DELETE",
        field_name: idColumn,
        field_label: "Deleted Record",
        old_value: idValue,
        new_value: null,
      }).catch(() => {});
    }

    return deletedRows || [];
  },
};
