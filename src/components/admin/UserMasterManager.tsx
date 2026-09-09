import React, { useState, useMemo } from "react";
import {
  User,
  Shield,
  Key,
  Check,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Lock,
  Layers,
  ShieldCheck,
  X,
  UserCheck,
  UserX,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Info,
  Hash,
} from "lucide-react";
import { ALL_SYSTEM_MODULES, SystemModuleDef } from "../../lib/permissions";

export interface UserMasterRow {
  user_id?: string | number;
  username?: string;
  password?: string;
  password_hash?: string;
  role?: string;
  status?: string;
  is_active?: boolean | string;
  allowed_modules?: string;
  level?: string;
  created_at?: string;
  last_login?: string | null;
  [key: string]: any;
}

// Helper: Format readable date
function formatTimestamp(isoStr?: string | null): { formatted: string; full: string } {
  if (!isoStr) return { formatted: "Never", full: "Never logged in" };
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { formatted: String(isoStr), full: String(isoStr) };
    const datePart = d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return {
      formatted: `${datePart}, ${timePart}`,
      full: d.toISOString(),
    };
  } catch {
    return { formatted: String(isoStr), full: String(isoStr) };
  }
}

// Module map for fast lookup
const MODULE_LOOKUP: Record<string, SystemModuleDef> = {};
ALL_SYSTEM_MODULES.forEach((m) => {
  MODULE_LOOKUP[m.id.toLowerCase()] = m;
  m.aliases.forEach((a) => {
    if (!MODULE_LOOKUP[a.toLowerCase()]) {
      MODULE_LOOKUP[a.toLowerCase()] = m;
    }
  });
});

function getModuleFriendlyName(idOrAlias: string): string {
  const clean = idOrAlias.toLowerCase().trim();
  if (clean === "*") return "All Modules";
  return MODULE_LOOKUP[clean]?.label || idOrAlias;
}

/* =========================================================================
   1. USER MASTER MAIN VIEW (TABLE COMPONENT)
   ========================================================================= */

interface UserMasterTableViewProps {
  data: UserMasterRow[];
  loading?: boolean;
  onEdit: (row: UserMasterRow) => void;
  onDelete: (id: any) => void;
  onAddNew: () => void;
  pk?: string;
}

export const UserMasterTableView: React.FC<UserMasterTableViewProps> = ({
  data,
  loading = false,
  onEdit,
  onDelete,
  onAddNew,
  pk = "user_id",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Summary statistics
  const stats = useMemo(() => {
    const total = data.length;
    const active = data.filter((u) => {
      const s = String(u.status || u.is_active || "").toLowerCase();
      return s === "active" || s === "true" || s === "1";
    }).length;
    const admins = data.filter((u) => String(u.role || "").toUpperCase() === "ADMIN").length;
    const operators = data.filter((u) => {
      const r = String(u.role || "").toUpperCase();
      return r === "OPERATOR" || r === "USER";
    }).length;
    return { total, active, inactive: total - active, admins, operators };
  }, [data]);

  // Filtered rows
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // Role filter
      if (roleFilter !== "ALL") {
        const r = String(row.role || "").toUpperCase();
        if (r !== roleFilter) return false;
      }
      // Status filter
      if (statusFilter !== "ALL") {
        const isActive =
          String(row.status || "").toLowerCase() === "active" ||
          String(row.is_active || "").toLowerCase() === "true" ||
          (row.status as any) === true;
        if (statusFilter === "Active" && !isActive) return false;
        if (statusFilter === "Inactive" && isActive) return false;
      }
      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const matchUserId = String(row.user_id || "").toLowerCase().includes(term);
      const matchUsername = String(row.username || "").toLowerCase().includes(term);
      const matchRole = String(row.role || "").toLowerCase().includes(term);
      const matchModules = String(row.allowed_modules || "").toLowerCase().includes(term);
      const matchLevel = String(row.level || "").toLowerCase().includes(term);
      return matchUserId || matchUsername || matchRole || matchModules || matchLevel;
    });
  }, [data, searchTerm, roleFilter, statusFilter]);

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col font-sans transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-[#1E331B] to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                USER MASTER DIRECTORY
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Records
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              Enterprise security credentials, role assignments, and granular operational permissions
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            id="btn_add_new_user"
            type="button"
            onClick={onAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-emerald-400/40"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Row Item / Add User</span>
          </button>
        </div>
      </div>

      {/* Stats KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80">
        <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Accounts
            </span>
            <span className="text-base sm:text-lg font-extrabold text-slate-800 font-mono">
              {stats.total}
            </span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <User className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="bg-white border border-emerald-200 p-2.5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Active Users
            </span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-700 font-mono">
              {stats.active}
            </span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <UserCheck className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="bg-white border border-indigo-200 p-2.5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
              Administrators
            </span>
            <span className="text-base sm:text-lg font-extrabold text-indigo-800 font-mono">
              {stats.admins}
            </span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Shield className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="bg-white border border-amber-200 p-2.5 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
              Operators & Desk
            </span>
            <span className="text-base sm:text-lg font-extrabold text-amber-800 font-mono">
              {stats.operators}
            </span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <Layers className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="user_master_search_input"
            type="text"
            placeholder="Search by User ID, username, role, module..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-[11px] font-bold">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Role:</span>
            {["ALL", "ADMIN", "SUPER USER", "OPERATOR", "USER"].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-tight transition-all cursor-pointer ${
                  roleFilter === role
                    ? "bg-white text-emerald-950 font-black shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-[11px] font-bold">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Status:</span>
            {["ALL", "Active", "Inactive"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-tight transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-emerald-950 font-black shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-sans">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider">
              <th className="py-3 px-3 text-center w-[120px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200 shadow-2xs">
                Actions
              </th>
              <th className="py-3 px-3 w-[80px]">User ID</th>
              <th className="py-3 px-4 min-w-[140px]">Username</th>
              <th className="py-3 px-3 min-w-[110px]">Password</th>
              <th className="py-3 px-3 min-w-[110px]">Role</th>
              <th className="py-3 px-3 min-w-[90px]">Status</th>
              <th className="py-3 px-4 min-w-[240px]">Allowed Modules</th>
              <th className="py-3 px-3 w-[70px]">Level</th>
              <th className="py-3 px-4 min-w-[150px]">Created At</th>
              <th className="py-3 px-4 min-w-[150px]">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
                    <span>Loading User Master records...</span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <UserX className="h-8 w-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                      No matching user accounts found
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Try clearing search filters or click "New Row Item / Add User" to register an operator.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => {
                const rowId = String(row[pk] || row.user_id || idx);
                const isPasswordVisible = showPasswords[rowId];
                const rawPassword = row.password || row.password_hash || "";
                const isStatusActive =
                  String(row.status || "").toLowerCase() === "active" ||
                  String(row.is_active || "").toLowerCase() === "true" ||
                  (row.status as any) === true;

                const roleName = String(row.role || "USER").toUpperCase();
                const levelName = String(row.level || "L1").toUpperCase();

                // Allowed modules processing
                const allowedModulesRaw = (row.allowed_modules || "*").trim();
                const isFullAccess = allowedModulesRaw === "*";
                const moduleTokens = allowedModulesRaw
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);

                const createdAtInfo = formatTimestamp(row.created_at);
                const lastLoginInfo = formatTimestamp(row.last_login);

                return (
                  <tr
                    key={rowId}
                    onClick={() => onEdit(row)}
                    title="Click row to edit account metadata"
                    className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Actions Column */}
                    <td
                      className="py-2.5 px-3 text-center sticky left-0 bg-white group-hover:bg-emerald-50/40 z-10 border-r border-slate-200/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          id={`btn_edit_user_${rowId}`}
                          onClick={() => onEdit(row)}
                          title="Edit User Metadata"
                          className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase rounded-md border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3 stroke-[2.5]" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          id={`btn_delete_user_${rowId}`}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete user "${row.username || rowId}"?`)) {
                              onDelete(row[pk] || row.user_id);
                            }
                          }}
                          title="Delete User Record"
                          className="flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] uppercase rounded-md border border-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3 stroke-[2.5]" />
                          <span>Del</span>
                        </button>
                      </div>
                    </td>

                    {/* User ID */}
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[11px] font-extrabold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        #{String(row.user_id || "—").padStart(3, "0")}
                      </span>
                    </td>

                    {/* Username */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black text-xs shrink-0 uppercase shadow-2xs">
                          {String(row.username || "U").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-xs tracking-tight block truncate uppercase">
                            {row.username || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Password with Show/Hide toggle */}
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-slate-700 font-bold tracking-wider select-all">
                          {isPasswordVisible ? rawPassword || "(blank)" : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(rowId)}
                          title={isPasswordVisible ? "Hide password" : "Show password"}
                          className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer rounded"
                        >
                          {isPasswordVisible ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-2.5 px-3">
                      {roleName === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Shield className="h-3 w-3" />
                          ADMIN
                        </span>
                      ) : roleName === "SUPER USER" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          <Sparkles className="h-3 w-3" />
                          SUPER USER
                        </span>
                      ) : roleName === "OPERATOR" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          <User className="h-3 w-3" />
                          OPERATOR
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {roleName}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      {isStatusActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Allowed Modules (Pills / Badges) */}
                    <td className="py-2.5 px-4 max-w-[280px]">
                      {isFullAccess ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                          ★ Full Access (*)
                        </span>
                      ) : moduleTokens.length === 0 ? (
                        <span className="text-[10px] text-slate-400 italic">No modules granted</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center" title={allowedModulesRaw}>
                          {moduleTokens.slice(0, 3).map((token) => (
                            <span
                              key={token}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9.5px] font-semibold border border-slate-200 truncate max-w-[110px]"
                            >
                              {getModuleFriendlyName(token)}
                            </span>
                          ))}
                          {moduleTokens.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[9.5px] font-extrabold border border-emerald-200">
                              +{moduleTokens.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Level */}
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[10.5px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {levelName}
                      </span>
                    </td>

                    {/* Created At */}
                    <td className="py-2.5 px-4" title={createdAtInfo.full}>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                        <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{createdAtInfo.formatted}</span>
                      </div>
                    </td>

                    {/* Last Login */}
                    <td className="py-2.5 px-4" title={lastLoginInfo.full}>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                        <span
                          className={`truncate ${
                            lastLoginInfo.formatted === "Never"
                              ? "italic text-slate-400"
                              : "text-slate-700 font-semibold"
                          }`}
                        >
                          {lastLoginInfo.formatted}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count indicator */}
      <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-semibold">
        <span>
          Showing <strong className="text-slate-800">{filteredData.length}</strong> of{" "}
          <strong className="text-slate-800">{data.length}</strong> user records
        </span>
        <span className="text-[11px] text-slate-400">
          Click any row to view & update account permissions
        </span>
      </div>
    </div>
  );
};

/* =========================================================================
   2. USER MASTER ADD / EDIT MODAL COMPONENT
   ========================================================================= */

interface UserMasterEditModalProps {
  isOpen: boolean;
  isNew: boolean;
  editingRow: UserMasterRow | null;
  setEditingRow: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onSave: () => Promise<void> | void;
  allRows?: UserMasterRow[];
  loading?: boolean;
}

export const UserMasterEditModal: React.FC<UserMasterEditModalProps> = ({
  isOpen,
  isNew,
  editingRow,
  setEditingRow,
  onClose,
  onSave,
  allRows = [],
  loading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");

  if (!isOpen || !editingRow) return null;

  // Auto-calculated user_id if new
  const currentUserId = useMemo(() => {
    if (editingRow.user_id) return String(editingRow.user_id);
    if (!isNew) return "";
    let nextNum = 1;
    if (allRows && allRows.length > 0) {
      const numericIds = allRows
        .filter((r) => String(r.user_id || "").length < 10)
        .map((r) => {
          const matched = String(r.user_id).match(/\d+/);
          return matched ? parseInt(matched[0], 10) : NaN;
        })
        .filter((n) => !isNaN(n));
      if (numericIds.length > 0) {
        nextNum = Math.max(...numericIds) + 1;
      }
    }
    return String(nextNum).padStart(3, "0");
  }, [editingRow.user_id, isNew, allRows]);

  // Sync auto user_id into editingRow if blank
  React.useEffect(() => {
    if (isNew && !editingRow.user_id && currentUserId) {
      setEditingRow((prev: any) => ({ ...prev, user_id: currentUserId }));
    }
    if (isNew && !editingRow.status) {
      setEditingRow((prev: any) => ({ ...prev, status: "Active" }));
    }
    if (isNew && !editingRow.role) {
      setEditingRow((prev: any) => ({ ...prev, role: "USER" }));
    }
    if (isNew && !editingRow.level) {
      setEditingRow((prev: any) => ({ ...prev, level: "L1" }));
    }
  }, [isNew, currentUserId]);

  const username = editingRow.username || "";
  const password = editingRow.password || editingRow.password_hash || "";
  const role = editingRow.role || "USER";
  const status = editingRow.status || "Active";
  const level = editingRow.level || "L1";

  // Allowed modules state management
  const allowedModulesVal = (editingRow.allowed_modules || "*").trim();
  const isAll = allowedModulesVal === "*";

  const selectedList = useMemo(() => {
    if (isAll) {
      return ALL_SYSTEM_MODULES.map((m) => m.id.toLowerCase());
    }
    return allowedModulesVal
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }, [allowedModulesVal, isAll]);

  // Group modules by category
  const categories = useMemo(() => {
    const set = new Set<string>();
    ALL_SYSTEM_MODULES.forEach((m) => set.add(m.category));
    return Array.from(set);
  }, []);

  const handleToggleModule = (id: string) => {
    const lowerId = id.toLowerCase();
    let newList: string[];

    if (isAll) {
      // If currently all, unchecking one means all EXCEPT this one
      newList = ALL_SYSTEM_MODULES.map((m) => m.id.toLowerCase()).filter((x) => x !== lowerId);
    } else if (selectedList.includes(lowerId)) {
      newList = selectedList.filter((x) => x !== lowerId);
    } else {
      newList = [...selectedList, lowerId];
    }

    const valToSave =
      newList.length === ALL_SYSTEM_MODULES.length ? "*" : newList.join(",");
    setEditingRow((prev: any) => ({ ...prev, allowed_modules: valToSave }));
  };

  const handleToggleAll = () => {
    if (isAll) {
      setEditingRow((prev: any) => ({ ...prev, allowed_modules: "" }));
    } else {
      setEditingRow((prev: any) => ({ ...prev, allowed_modules: "*" }));
    }
  };

  const handleApplyPreset = (presetModules: string[]) => {
    const valToSave = presetModules.join(",");
    setEditingRow((prev: any) => ({ ...prev, allowed_modules: valToSave }));
  };

  const handleToggleCategory = (categoryName: string) => {
    const categoryModules = ALL_SYSTEM_MODULES.filter((m) => m.category === categoryName).map((m) =>
      m.id.toLowerCase()
    );
    const allCategorySelected = categoryModules.every((id) => selectedList.includes(id));

    let newList: string[];
    if (isAll) {
      // Demote to explicit list minus this category
      newList = ALL_SYSTEM_MODULES.map((m) => m.id.toLowerCase()).filter(
        (id) => !categoryModules.includes(id)
      );
    } else if (allCategorySelected) {
      // Remove all in category
      newList = selectedList.filter((id) => !categoryModules.includes(id));
    } else {
      // Add all missing in category
      newList = Array.from(new Set([...selectedList, ...categoryModules]));
    }

    const valToSave =
      newList.length === ALL_SYSTEM_MODULES.length ? "*" : newList.join(",");
    setEditingRow((prev: any) => ({ ...prev, allowed_modules: valToSave }));
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[200] flex items-center justify-center p-3 sm:p-5 font-sans animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#1E331B] to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  {isNew ? "Create New User Account" : "Edit User Account Metadata"}
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-mono text-xs font-bold border border-emerald-500/30">
                  ID: #{currentUserId || "AUTO"}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                User Master profile, role assignment, and granular system permission matrix
              </p>
            </div>
          </div>

          <button
            id="modal_close_button"
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
          {/* Section 1: Account Credentials & Identity */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Key className="h-4 w-4 text-emerald-700" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Account Credentials & Identity
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* User ID */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Hash className="h-3 w-3 text-slate-400" />
                  User ID (System Auto)
                </label>
                <input
                  id="field_user_id"
                  type="text"
                  value={currentUserId}
                  onChange={(e) =>
                    setEditingRow((prev: any) => ({ ...prev, user_id: e.target.value }))
                  }
                  placeholder="e.g. 001"
                  className="w-full bg-slate-100/90 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-slate-800 outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="h-3 w-3 text-slate-400" />
                  Username
                </label>
                <input
                  id="field_username"
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setEditingRow((prev: any) => ({ ...prev, username: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. RAHUL"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold uppercase text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              {/* Password with Show/Hide toggle */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-slate-400" />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="field_password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) =>
                      setEditingRow((prev: any) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Enter account password"
                    className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-9 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-slate-400" />
                  Role
                </label>
                <div className="relative">
                  <select
                    id="field_role"
                    value={role}
                    onChange={(e) =>
                      setEditingRow((prev: any) => ({ ...prev, role: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 appearance-none cursor-pointer pr-8"
                  >
                    <option value="OPERATOR">OPERATOR (Standard Mill Entry)</option>
                    <option value="USER">USER (General Access)</option>
                    <option value="SUPER USER">SUPER USER (Elevated Desk)</option>
                    <option value="ADMIN">ADMIN (Full Administrative Rights)</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-slate-400" />
                  Status
                </label>
                <div className="relative">
                  <select
                    id="field_status"
                    value={status}
                    onChange={(e) =>
                      setEditingRow((prev: any) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 appearance-none cursor-pointer pr-8"
                  >
                    <option value="Active">Active (Permitted Login)</option>
                    <option value="Inactive">Inactive (Account Suspended)</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Level */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-slate-400" />
                  Security Level
                </label>
                <div className="relative">
                  <select
                    id="field_level"
                    value={level}
                    onChange={(e) =>
                      setEditingRow((prev: any) => ({ ...prev, level: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold font-mono text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 appearance-none cursor-pointer pr-8"
                  >
                    <option value="L1">L1 — Operational Desk</option>
                    <option value="L2">L2 — Supervisor Review</option>
                    <option value="L3">L3 — Section Manager</option>
                    <option value="L4">L4 — Mill Executive</option>
                    <option value="L5">L5 — System Super Administrator</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Permissions Matrix (Allowed Modules) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
            {/* Header with Permissions Summary & DB Value */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Allowed Modules & Permissions Matrix
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Toggle individual modules or apply enterprise permission presets
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                  {isAll ? "★ FULL ACCESS (*)" : `${selectedList.length} Permitted Module(s)`}
                </span>
                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg truncate max-w-[220px]" title={allowedModulesVal}>
                  DB: {allowedModulesVal || "(none)"}
                </span>
              </div>
            </div>

            {/* Presets Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Full Access Toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-500 transition-all">
                  <input
                    id="checkbox_full_access"
                    type="checkbox"
                    checked={isAll}
                    onChange={handleToggleAll}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-emerald-950 uppercase tracking-tight">
                    ★ * (Full Access to All Modules)
                  </span>
                </label>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(["sauda"])}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-[10.5px] font-bold uppercase transition-colors cursor-pointer border border-amber-200"
                  >
                    Sauda Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(["main_gate"])}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg text-[10.5px] font-bold uppercase transition-colors cursor-pointer border border-blue-200"
                  >
                    Main Gate Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(["sms_sauda"])}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-lg text-[10.5px] font-bold uppercase transition-colors cursor-pointer border border-purple-200"
                  >
                    SMS Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(["sauda", "main_gate", "sms_sauda"])}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg text-[10.5px] font-bold uppercase transition-colors cursor-pointer border border-emerald-200"
                  >
                    Sauda + Gate + SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRow((prev: any) => ({ ...prev, allowed_modules: "" }))}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg text-[10.5px] font-bold uppercase transition-colors cursor-pointer border border-rose-200"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Categorized Permission Groups */}
            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
              {categories.map((category) => {
                const items = ALL_SYSTEM_MODULES.filter((m) => m.category === category);
                const selectedInGroup = items.filter(
                  (item) => isAll || selectedList.includes(item.id.toLowerCase())
                ).length;
                const isGroupAllSelected = selectedInGroup === items.length;

                return (
                  <div
                    key={category}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    {/* Category Title & Group Action */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                          {category}
                        </span>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                          {selectedInGroup}/{items.length} Enabled
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleCategory(category)}
                        disabled={isAll}
                        className="text-[10px] font-bold uppercase tracking-tight text-emerald-700 hover:text-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isGroupAllSelected ? "Deselect Group" : "Select All Group"}
                      </button>
                    </div>

                    {/* Module Checkboxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {items.map((item) => {
                        const isChecked = isAll || selectedList.includes(item.id.toLowerCase());
                        return (
                          <label
                            key={item.id}
                            className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                              isChecked
                                ? "bg-emerald-50/50 border-emerald-200 text-emerald-950 font-bold"
                                : "bg-slate-50/60 border-slate-200/80 text-slate-600 hover:bg-slate-100"
                            } ${isAll ? "opacity-90" : ""}`}
                          >
                            <input
                              type="checkbox"
                              id={`module_perm_${item.id}`}
                              checked={isChecked}
                              disabled={isAll}
                              onChange={() => handleToggleModule(item.id)}
                              className="mt-0.5 h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold block truncate leading-tight">
                                {item.label}
                              </span>
                              <span className="text-[9.5px] font-mono text-slate-400 block truncate">
                                id: {item.id}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Info className="h-4 w-4 text-slate-400" />
            <span>
              Permissions are synced live across active operator tabs upon saving.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              id="btn_cancel_user_modal"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            <button
              id="btn_save_user_modal"
              type="button"
              onClick={onSave}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border border-emerald-400/40 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Record...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>Save Item</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
