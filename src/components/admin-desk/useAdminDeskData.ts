import { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabase';
import { dbModule } from '../../services/dbModule';
import { canDeleteData } from '../../lib/utils';
import { broadcastPermissionsUpdated } from '../../lib/permissions';
import { logChange } from '../../services/auditLogService';
import { TableDef, TABLES } from './adminDeskTypes';
import { Database } from 'lucide-react';

interface UseAdminDeskDataProps {
  isAuthenticated: boolean;
}

export function useAdminDeskData({ isAuthenticated }: UseAdminDeskDataProps) {
  const [tables, setTables] = useState<TableDef[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableDef | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRow, setEditingRow] = useState<any>(null);
  const [isNewRow, setIsNewRow] = useState<boolean>(false);
  const lastEditingRowRef = useRef<any>(null);

  useEffect(() => {
    if (editingRow !== null && lastEditingRowRef.current === null) {
      const isNew = Object.keys(editingRow).length === 0;
      setIsNewRow(isNew);
    }
    lastEditingRowRef.current = editingRow;
  }, [editingRow]);

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('TEXT');
  const [newTableName, setNewTableName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Memoize purchaseOrders with real database values or fallback defaults
  const purchaseOrders = useMemo(() => {
    if (data && data.length > 0 && selectedTable?.name === 'purchase_master') {
      return data;
    }
    return [
      { po_no: 'PO-88/26', supplier: 'BENGAL BALING CO.', broker: 'DIRECT', area: 'KOLKATA CORE', total_contract_mt: 45, b_rate: 17400 },
      { po_no: 'PO-102/26', supplier: 'BIHAR ASSOCIATED FIBRES', broker: 'K.C. CHOPRA', area: 'BIHAR VALLEY', total_contract_mt: 36, b_rate: 17150 },
      { po_no: 'PO-115/26', supplier: 'ORISSA JUTE EXPORTERS', broker: 'R.K. MEHTA', area: 'ORISSA COAST', total_contract_mt: 60, b_rate: 17600 },
      { po_no: 'PO-142/26', supplier: 'EASTERN BALER TRADERS', broker: 'DIRECT', area: 'ASSAM REGION', total_contract_mt: 50, b_rate: 17200 },
    ];
  }, [data, selectedTable]);

  // Read tables schema metadata
  const fetchTables = async () => {
    setTables(TABLES);
    if (!selectedTable) setSelectedTable(TABLES[0]);
  };

  const fetchData = async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      let remoteRecords: any[] = [];
      let localRecords: any[] = [];

      try {
        localRecords = await dbModule.fetchAll(selectedTable.name);
      } catch (e) {}

      if (supabase) {
        const { data: remoteData, error } = await supabase
          .from(selectedTable.name)
          .select("*")
          .order(selectedTable.pk, { ascending: true })
          .limit(300);

        if (!error && remoteData) {
          remoteRecords = remoteData;
        }
      }

      const pk = selectedTable.pk;
      const combinedMap = new Map<string, any>();

      // Populate with local client database records first
      (localRecords || []).forEach((rec: any) => {
        const key = String(rec[pk] ?? rec.user_id ?? rec.id ?? '').trim();
        if (key) combinedMap.set(key, rec);
      });

      // Merge remote records (remote records take precedence if updated)
      (remoteRecords || []).forEach((rec: any) => {
        const key = String(rec[pk] ?? rec.user_id ?? rec.id ?? '').trim();
        if (key) combinedMap.set(key, rec);
      });

      const merged = Array.from(combinedMap.values());
      merged.sort((a, b) => {
        const aVal = a[pk] ?? '';
        const bVal = b[pk] ?? '';
        if (!isNaN(Number(aVal)) && !isNaN(Number(bVal))) {
          return Number(aVal) - Number(bVal);
        }
        return String(aVal).localeCompare(String(bVal));
      });

      let finalData = merged.length > 0 ? merged : (remoteRecords.length > 0 ? remoteRecords : localRecords);
      if (selectedTable.name === 'tolerance_policy' && finalData.length === 0) {
        finalData = [{
          id: '01',
          status: 'ACTIVE',
          policy_name: 'Raw Jute Bales Standard Policy (5% or 1500 KG)',
          description: 'Lower of 5% of Sauda contract quantity or 1,500 KG (15.00 Qtl / 1.500 MT).',
          tolerance_pct: 5,
          max_limit_kg: 1500,
          max_limit_mt: 1.500,
          unit: 'BALES',
          rule_formula: 'Min(5% of Sauda MT, 1.500 MT)',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }];
      }
      setData(finalData);
    } catch (err) {
      console.error(err);
      const fallbackRecords = await dbModule.fetchAll(selectedTable.name).catch(() => []);
      setData(fallbackRecords);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTables();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedTable) {
      fetchData();
    }
  }, [selectedTable]);

  const currentColumns = useMemo(() => {
    if (!data || data.length === 0) {
      if (selectedTable?.name === "user_master") {
        return [
          { name: "user_id", type: "text" },
          { name: "username", type: "text" },
          { name: "email", type: "text" }, { name: "auth_user_id", type: "text" },
          { name: "role", type: "text" },
          { name: "status", type: "text" },
          { name: "allowed_modules", type: "text" },
          { name: "level", type: "text" },
          { name: "last_login", type: "timestamp" },
          { name: "created_at", type: "timestamp" },
        ];
      }
      if (selectedTable?.name === "tolerance_policy") {
        return [
          { name: "id", type: "text" },
          { name: "status", type: "text" },
          { name: "policy_name", type: "text" },
          { name: "description", type: "text" },
          { name: "tolerance_pct", type: "number" },
          { name: "max_limit_kg", type: "number" },
          { name: "max_limit_mt", type: "number" },
          { name: "unit", type: "text" },
          { name: "rule_formula", type: "text" },
          { name: "is_active", type: "text" },
          { name: "created_at", type: "timestamp" },
          { name: "updated_at", type: "timestamp" }
        ];
      }
      if (selectedTable?.name === "user_activity_logs") {
        return [
          { name: "log_id", type: "text" },
          { name: "username", type: "text" },
          { name: "activity_type", type: "text" },
          { name: "module_name", type: "text" },
          { name: "action_details", type: "text" },
          { name: "ip_address", type: "text" },
          { name: "created_at", type: "timestamp" }
        ];
      }
      return [{ name: selectedTable?.pk || "id", type: "text" }];
    }
    const cols = Object.keys(data[0]);
    if (selectedTable?.name === "user_master") {
      const standardOrder = ["user_id", "username", "email", "auth_user_id", "role", "status", "allowed_modules", "level", "last_login", "created_at"];
      standardOrder.forEach(sc => {
        if (!cols.includes(sc)) cols.push(sc);
      });
    }
    if (selectedTable?.name === "user_activity_logs") {
      const standardOrder = ["log_id", "username", "activity_type", "module_name", "action_details", "ip_address", "created_at"];
      standardOrder.forEach(sc => {
        if (!cols.includes(sc)) cols.push(sc);
      });
    }
    if (selectedTable?.name === "tolerance_policy") {
      const standardOrder = ["id", "status", "policy_name", "description", "tolerance_pct", "max_limit_kg", "max_limit_mt", "unit", "rule_formula", "is_active", "created_at", "updated_at"];
      const reordered: string[] = [];
      standardOrder.forEach(sc => {
        if (cols.includes(sc)) reordered.push(sc);
      });
      cols.forEach(c => {
        if (!reordered.includes(c)) reordered.push(c);
      });
      return reordered.map((key) => ({
        name: key,
        type: typeof data[0][key] === "number" ? "number" : "text",
      }));
    }
    return cols.map((key) => ({
      name: key,
      type: typeof data[0][key] === "number" ? "number" : "text",
    }));
  }, [data, selectedTable]);

  const editorColumns = useMemo(() => {
    return currentColumns.map((col) => col.name);
  }, [currentColumns]);

  const handleSave = async () => {
    if (!selectedTable || !editingRow) return;
    setLoading(true);
    try {
      const pk = selectedTable.pk;
      const isNew = isNewRow;

      if (selectedTable.name === "user_master") {
        if (!editingRow.username || !String(editingRow.username).trim()) {
          alert("Error: Username is required for User Master.");
          setLoading(false);
          return;
        }
        if (!editingRow.auth_user_id || !editingRow.email) {
          throw new Error('Create the account in Supabase Auth first, then enter its UUID and email.');
        }
        // Generate unique user_id if missing or duplicate
        if (!editingRow.user_id || String(editingRow.user_id).trim() === "") {
          let maxNum = 1;
          if (data && data.length > 0) {
            const numericIds = data
              .map((r) => {
                const matched = String(r.user_id || "").match(/\d+/);
                return matched ? parseInt(matched[0], 10) : NaN;
              })
              .filter((n) => !isNaN(n));
            if (numericIds.length > 0) {
              maxNum = Math.max(...numericIds) + 1;
            }
          }
          editingRow.user_id = String(maxNum).padStart(3, "0");
        } else if (!isNaN(Number(editingRow.user_id))) {
          editingRow.user_id = String(Number(editingRow.user_id)).padStart(3, "0");
        }

        editingRow.username = String(editingRow.username).trim().toUpperCase();
        delete editingRow.password;
        delete editingRow.password_hash;
        editingRow.role = String(editingRow.role || "USER").trim().toUpperCase();
        editingRow.level = String(editingRow.level || "L1").trim().toUpperCase();
        editingRow.status = editingRow.status ? (editingRow.status.charAt(0).toUpperCase() + editingRow.status.slice(1).toLowerCase()) : "Active";
        if (editingRow.allowed_modules === undefined || editingRow.allowed_modules === null || editingRow.allowed_modules === "") {
          editingRow.allowed_modules = "[]";
        }
        if (!editingRow.created_at) {
          editingRow.created_at = new Date().toISOString();
        }
      }

      if (!supabase) {
        if (isNew) {
          await dbModule.insert(selectedTable.name, editingRow);
        } else {
          await dbModule.update(
            selectedTable.name,
            pk,
            editingRow[pk],
            editingRow
          );
        }
      } else {
        if (selectedTable.name === "user_master") {
          const userPayload: any = {
            user_id: editingRow.user_id,
            username: editingRow.username,
            email: editingRow.email,
            auth_user_id: editingRow.auth_user_id,
            role: editingRow.role,
            status: editingRow.status,
            allowed_modules: editingRow.allowed_modules,
            level: editingRow.level,
            created_at: editingRow.created_at || new Date().toISOString()
          };
          if (editingRow.last_login && String(editingRow.last_login).trim() !== "" && String(editingRow.last_login).trim() !== "null") {
            userPayload.last_login = editingRow.last_login;
          }

          // Remote Supabase store upsert
          const { error } = await supabase
            .from("user_master")
            .upsert(userPayload, { onConflict: "user_id" });
          if (error) throw error;
        } else if (isNew) {
          const insertPayload = { ...editingRow };
          if (insertPayload.id === "" || insertPayload.id === null) {
            delete insertPayload.id;
          }
          const { error } = await supabase
            .from(selectedTable.name)
            .insert(insertPayload);
          if (error) throw error;
        } else {
          const updatePayload = { ...editingRow };
          const pkVal = updatePayload[pk];
          const { error } = await supabase
            .from(selectedTable.name)
            .update(updatePayload)
            .eq(pk, pkVal);
          if (error) throw error;
        }
      }

      if (selectedTable.name === "user_master") {
        broadcastPermissionsUpdated({
          userId: editingRow?.user_id,
          username: editingRow?.username,
          allowed_modules: editingRow?.allowed_modules,
          role: editingRow?.role,
          level: editingRow?.level
        });
      }

      setEditingRow(null);
      await fetchData();
      alert("Changes committed to database successfully.");
    } catch (err: any) {
      console.error("Save error:", err);
      try {
        const pk = selectedTable.pk;
        if (isNewRow) {
          await dbModule.insert(selectedTable.name, editingRow);
        } else {
          await dbModule.update(selectedTable.name, pk, editingRow[pk], editingRow);
        }
        if (selectedTable.name === "user_master") {
          broadcastPermissionsUpdated({
            userId: editingRow?.user_id,
            username: editingRow?.username,
            allowed_modules: editingRow?.allowed_modules,
            role: editingRow?.role,
            level: editingRow?.level
          });
        }
        setEditingRow(null);
        await fetchData();
        alert("Changes saved to local client database successfully.");
        return;
      } catch (e) {}
      alert(`Operation Failed: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pkValue: any) => {
    if (!canDeleteData()) {
      alert("🔒 Access Denied: Only Admin users (L5 / System Administrator) are authorized to delete records.");
      return;
    }
    if (!selectedTable) return;
    if (!confirm(`Are you certain you want to purge record with ${selectedTable.pk}: ${pkValue}?`)) {
      return;
    }
    setLoading(true);
    try {
      if (!supabase) {
        await dbModule.delete(selectedTable.name, selectedTable.pk, pkValue);
      } else {
        const { error } = await supabase
          .from(selectedTable.name)
          .delete()
          .eq(selectedTable.pk, pkValue);
        if (error) throw error;
      }
      if (selectedTable.name === "user_master") {
        broadcastPermissionsUpdated({});
      }
      await fetchData();
      alert("Record successfully deleted from database.");
    } catch (err: any) {
      console.error(err);
      alert(`Purge failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteColumn = async (columnName: string) => {
    alert('Apply schema changes through reviewed database migrations.');
  };

  const handleAddField = async () => {
    alert('Apply schema changes through reviewed database migrations.');
  };

  const handleCreateTable = async () => {
    alert('Apply schema changes through reviewed database migrations.');
  };

  const handleDropTable = async (tableName: string) => {
    alert('Apply schema changes through reviewed database migrations.');
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTable) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (!results.data || results.data.length === 0) {
          alert("CSV is empty or could not be parsed.");
          return;
        }
        setLoading(true);
        try {
          if (!supabase) {
            for (const row of results.data) {
              await dbModule.insert(selectedTable.name, row);
            }
          } else {
            const { error } = await supabase
              .from(selectedTable.name)
              .insert(results.data);
            if (error) throw error;
          }
          await fetchData();
          alert(`Successfully imported ${results.data.length} records into ${selectedTable.name}.`);
        } catch (err: any) {
          alert(`CSV Import Failed: ${err.message}`);
        } finally {
          setLoading(false);
          e.target.value = "";
        }
      },
    });
  };

  const handleDatabaseExport = async () => {
    setIsExporting(true);
    try {
      const exportData: Record<string, any[]> = {};
      const tablesToExport = tables.length > 0 ? tables : TABLES;

      for (const table of tablesToExport) {
        try {
          if (supabase) {
            const { data, error } = await supabase.from(table.name).select("*").limit(1000);
            if (!error && data) {
              exportData[table.name] = data;
              continue;
            }
          }
          const localData = await dbModule.fetchAll(table.name).catch(() => []);
          exportData[table.name] = localData;
        } catch (e) {
          exportData[table.name] = [];
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Mill_ERP_Database_Full_Export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export error:", err);
      alert("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    tables,
    setTables,
    selectedTable,
    setSelectedTable,
    data,
    setData,
    loading,
    setLoading,
    searchTerm,
    setSearchTerm,
    editingRow,
    setEditingRow,
    isNewRow,
    setIsNewRow,
    newFieldName,
    setNewFieldName,
    newFieldType,
    setNewFieldType,
    newTableName,
    setNewTableName,
    isExporting,
    currentColumns,
    editorColumns,
    purchaseOrders,
    fetchTables,
    fetchData,
    handleSave,
    handleDelete,
    handleDeleteColumn,
    handleAddField,
    handleCreateTable,
    handleDropTable,
    handleCsvImport,
    handleDatabaseExport
  };
}
