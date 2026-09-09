import React, { useState } from "react";
import {
  X,
  Save,
  Lock,
  Edit3,
  Plus,
  AlertCircle,
  Database,
  Check,
  Sparkles,
  Info,
} from "lucide-react";
import { TableDef } from "./MasterTableNav";
import { ALL_SYSTEM_MODULES, getCurrentUserContext } from "../../lib/permissions";

interface ColumnDef {
  name: string;
  type: string;
}

interface DynamicRecordModalProps {
  isOpen: boolean;
  isNew: boolean;
  selectedTable?: TableDef | null;
  columns: ColumnDef[];
  editingRow: any;
  setEditingRow: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onSave: () => void;
  loading?: boolean;
}

export const DynamicRecordModal: React.FC<DynamicRecordModalProps> = ({
  isOpen,
  isNew,
  selectedTable,
  columns,
  editingRow,
  setEditingRow,
  onClose,
  onSave,
  loading = false,
}) => {
  const [jsonValidationErrors, setJsonValidationErrors] = useState<Record<string, string>>({});

  if (!isOpen || !editingRow) return null;

  // Determine editor columns from schema or row keys
  const editorColumns = columns && columns.length > 0
    ? columns.map((c) => c.name)
    : Object.keys(editingRow);

  // Field change helper
  const handleFieldChange = (col: string, val: any) => {
    setEditingRow((prev: any) => ({
      ...prev,
      [col]: val,
    }));
  };

  // Helper to format field labels cleanly
  const getFieldLabel = (col: string) => {
    if (selectedTable?.name === "user_activity_logs") {
      switch (col) {
        case "log_id": return "Log ID (System Auto)";
        case "username": return "Actor / Username";
        case "activity_type": return "Activity Type";
        case "module_name": return "Target Module";
        case "action_details": return "Action Details / Payload";
        case "ip_address": return "IP Address / Source";
        case "created_at": return "Event Timestamp";
      }
    }
    return col.replace(/_/g, " ").toUpperCase();
  };

  // Render individual input based on column attributes
  const renderFieldInput = (col: string) => {
    const val = editingRow?.[col] ?? "";
    const colInfo = columns.find((c) => c.name === col);
    const colType = (colInfo?.type || "").toLowerCase();
    const isPk = col === selectedTable?.pk || col === "id";

    // Primary key handling
    if (isPk) {
      if (!isNew) {
        return (
          <div className="relative">
            <input
              type="text"
              value={val}
              disabled
              readOnly
              className="w-full bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs px-3 py-2 rounded-lg cursor-not-allowed pr-8 select-all"
            />
            <Lock className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        );
      } else {
        const isUuidOrAuto =
          colType.includes("uuid") ||
          colType.includes("int") ||
          colType.includes("serial") ||
          colType.includes("identity") ||
          col === "id";

        if (isUuidOrAuto && selectedTable?.name !== "user_master") {
          return (
            <div className="relative">
              <input
                type="text"
                value="AUTO_GENERATED (System Sequence / UUID)"
                disabled
                readOnly
                className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-mono text-xs px-3 py-2 rounded-lg cursor-not-allowed italic pr-8"
              />
              <Sparkles className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-emerald-600" />
            </div>
          );
        }
      }
    }

    // Created At / Timestamp auto-generation
    if ((col === "created_at" || col === "timestamp") && !isNew) {
      return (
        <div className="relative">
          <input
            type="text"
            value={val || "Now (Auto-generated)"}
            disabled
            readOnly
            className="w-full bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs px-3 py-2 rounded-lg cursor-not-allowed pr-8"
          />
          <Lock className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>
      );
    }

    // Role Dropdown
    if (col === "role") {
      const activeRole = val || "OPERATOR";
      return (
        <select
          value={activeRole}
          onChange={(e) => handleFieldChange(col, e.target.value)}
          className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer"
        >
          <option value="OPERATOR">OPERATOR</option>
          <option value="USER">USER</option>
          <option value="SUPER USER">SUPER USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      );
    }

    // Level Dropdown
    if (col.toLowerCase() === "level") {
      const activeLevel = val || "L1";
      return (
        <select
          value={activeLevel}
          onChange={(e) => handleFieldChange(col, e.target.value)}
          className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer"
        >
          <option value="L1">L1 - Basic Operator</option>
          <option value="L2">L2 - Senior Clerk</option>
          <option value="L3">L3 - Department Supervisor</option>
          <option value="L4">L4 - Mill Manager</option>
          <option value="L5">L5 - Director / Executive</option>
        </select>
      );
    }

    // Status or is_active Dropdown
    if (col === "status" || col.toLowerCase() === "is_active" || colType.includes("bool")) {
      const activeVal =
        String(val).toLowerCase() === "true" ||
        val === true ||
        val === 1 ||
        val === "1" ||
        String(val).toLowerCase() === "active";

      return (
        <select
          value={activeVal ? "true" : "false"}
          onChange={(e) => handleFieldChange(col, e.target.value === "true")}
          className="w-full bg-white border border-slate-300 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 cursor-pointer"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      );
    }

    // Allowed Modules permissions matrix
    if (col === "allowed_modules") {
      const allModulesList = ALL_SYSTEM_MODULES;
      const currentVal = (String(val) || "").trim();
      const isAll = currentVal === "*";
      const selectedList = isAll
        ? allModulesList.map((m) => m.id)
        : currentVal.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

      const handleToggle = (id: string) => {
        const lowerId = id.toLowerCase();
        let newList: string[];
        if (selectedList.includes(lowerId)) {
          newList = selectedList.filter((x) => x !== lowerId);
        } else {
          newList = [...selectedList, lowerId];
        }
        const valToSave = newList.length === allModulesList.length ? "*" : newList.join(",");
        handleFieldChange(col, valToSave);
      };

      const handleToggleAll = () => {
        handleFieldChange(col, isAll ? "" : "*");
      };

      const handleApplyPreset = (presetModules: string[]) => {
        handleFieldChange(col, presetModules.join(","));
      };

      const categories = Array.from(new Set(allModulesList.map((m) => m.category)));

      return (
        <div className="border border-slate-200 p-3 rounded-xl bg-slate-50 space-y-3 max-h-[300px] overflow-y-auto w-full text-left shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="module-all-dialog"
                checked={isAll}
                onChange={handleToggleAll}
                className="rounded text-emerald-700 focus:ring-emerald-600 h-4 w-4 cursor-pointer accent-emerald-700"
              />
              <label htmlFor="module-all-dialog" className="text-xs font-bold text-emerald-950 uppercase cursor-pointer">
                ★ Full Access to All Modules (*)
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset(["sauda"])}
                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[10px] font-semibold border border-amber-300 transition-colors"
              >
                Sauda
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(["main_gate"])}
                className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded text-[10px] font-semibold border border-blue-300 transition-colors"
              >
                Main Gate
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(["sauda", "main_gate", "sms_sauda"])}
                className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded text-[10px] font-semibold border border-emerald-300 transition-colors"
              >
                Core Ops
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange(col, "")}
                className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[10px] font-semibold border border-rose-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {categories.map((cat) => {
              const items = allModulesList.filter((m) => m.category === cat);
              return (
                <div key={cat} className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    {cat}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {items.map((item) => {
                      const isChecked = isAll || selectedList.includes(item.id.toLowerCase());
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-700 hover:text-slate-900"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAll}
                            onChange={() => handleToggle(item.id)}
                            className="rounded text-emerald-700 focus:ring-emerald-600 h-3.5 w-3.5 accent-emerald-700"
                          />
                          <span className={isChecked ? "text-emerald-900 font-semibold" : "text-slate-600"}>
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // JSON or Long Text Objects (e.g. grid_details, action_details, remarks, etc.)
    const isJsonColumn =
      colType.includes("json") ||
      typeof val === "object" ||
      col === "action_details" ||
      col === "grid_details" ||
      col === "remarks" ||
      col === "changes_summary";

    if (isJsonColumn) {
      const displayString = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);

      return (
        <div className="space-y-1">
          <textarea
            rows={4}
            value={displayString}
            onChange={(e) => {
              const text = e.target.value;
              handleFieldChange(col, text);

              // Validate JSON syntax if it's a JSON column
              if (colType.includes("json")) {
                try {
                  JSON.parse(text);
                  setJsonValidationErrors((prev) => {
                    const copy = { ...prev };
                    delete copy[col];
                    return copy;
                  });
                } catch (err: any) {
                  setJsonValidationErrors((prev) => ({
                    ...prev,
                    [col]: "Invalid JSON format: " + err.message,
                  }));
                }
              }
            }}
            placeholder={`Enter ${col.replace(/_/g, " ")} details...`}
            className={`w-full bg-white border ${
              jsonValidationErrors[col] ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600"
            } text-slate-800 font-mono text-xs p-2.5 rounded-lg focus:outline-none focus:ring-1 transition-all`}
          />
          {jsonValidationErrors[col] && (
            <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {jsonValidationErrors[col]}
            </p>
          )}
        </div>
      );
    }

    // Numeric inputs
    const isNumeric =
      colType.includes("int") ||
      colType.includes("numeric") ||
      colType.includes("real") ||
      colType.includes("decimal") ||
      colType.includes("double");

    return (
      <input
        type={isNumeric ? "number" : "text"}
        value={val}
        onChange={(e) => handleFieldChange(col, e.target.value)}
        placeholder={`Enter ${col.replace(/_/g, " ")}`}
        className="w-full bg-white border border-slate-300 text-slate-800 font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all placeholder:text-slate-400 placeholder:font-sans"
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700 text-white rounded-xl shadow-xs">
              {isNew ? <Plus className="h-5 w-5" /> : <Edit3 className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {isNew ? "Create New Record" : "Edit Record Details"}
                </h3>
                <span className="font-mono text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                  {selectedTable?.label || "Entity"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Table: <span className="font-mono text-slate-700">{selectedTable?.name || "entity"}</span> • Primary Key:{" "}
                <span className="font-mono text-slate-700">{selectedTable?.pk || "id"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editorColumns.map((col) => {
              const label = getFieldLabel(col);
              const isFullWidth =
                col === "allowed_modules" ||
                col === "action_details" ||
                col === "grid_details" ||
                col === "remarks" ||
                col === "changes_summary";

              return (
                <div
                  key={col}
                  className={`space-y-1.5 ${isFullWidth ? "md:col-span-2" : ""}`}
                >
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>{label}</span>
                    <span className="text-[10px] font-mono text-slate-400 lowercase font-normal">
                      {columns.find((c) => c.name === col)?.type || "text"}
                    </span>
                  </label>
                  {renderFieldInput(col)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>Changes will be audited and logged permanently.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={loading || Object.keys(jsonValidationErrors).length > 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? "Saving..." : isNew ? "Save Record" : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicRecordModal;
