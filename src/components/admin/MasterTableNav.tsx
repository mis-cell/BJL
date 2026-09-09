import React, { useState, useMemo } from "react";
import { Database, Search, X, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";

export interface TableDef {
  name: string;
  label: string;
  icon: any;
  pk: string;
}

interface MasterTableNavProps {
  tables: TableDef[];
  selectedTable: TableDef | null;
  onSelectTable: (table: TableDef) => void;
  onRefreshTables: () => void;
  onDropTable: (tableName: string) => void;
  canDelete: boolean;
}

export const MasterTableNav: React.FC<MasterTableNavProps> = ({
  tables,
  selectedTable,
  onSelectTable,
  onRefreshTables,
  onDropTable,
  canDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase().trim();
    return tables.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [tables, searchQuery]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-col h-full overflow-hidden">
      {/* Header with Title & Stats */}
      <div className="p-3 bg-slate-50/80 border-b border-slate-200 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600/10 text-emerald-700 rounded-lg">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Master Tables
              </h2>
              <span className="text-[10px] text-slate-500 font-medium">
                {tables.length} schema entities registered
              </span>
            </div>
          </div>
          <button
            onClick={onRefreshTables}
            title="Reload schema list"
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search master tables..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100/50">
        {filteredTables.length === 0 ? (
          <div className="p-6 text-center text-slate-400 space-y-2">
            <Database className="h-8 w-8 mx-auto opacity-30 text-slate-400" />
            <p className="text-xs font-medium">No tables found matching &quot;{searchQuery}&quot;</p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-[11px] text-emerald-700 font-semibold hover:underline"
            >
              Clear search filter
            </button>
          </div>
        ) : (
          filteredTables.map((table) => {
            const isSelected = selectedTable?.name === table.name;
            const IconComponent = table.icon || Database;

            return (
              <div
                key={table.name}
                className="w-full relative group/item pt-1 first:pt-0"
              >
                <div
                  onClick={() => onSelectTable(table)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-300 shadow-xs"
                      : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden pr-6">
                    <div
                      className={`p-1 rounded-md shrink-0 transition-colors ${
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-500 group-hover/item:bg-slate-200 group-hover/item:text-slate-700"
                      }`}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <div className="overflow-hidden text-left">
                      <p className={`text-xs truncate ${isSelected ? "font-bold text-emerald-950" : "font-medium"}`}>
                        {table.label}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {table.name}
                      </p>
                    </div>
                  </div>

                  {/* Active Indicator or Delete Button */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Permanently drop table "${table.name}"? This cannot be undone.`)) {
                            onDropTable(table.name);
                          }
                        }}
                        title={`Drop ${table.name}`}
                        className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all ml-1 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info (NO "Switch Material Desk", NO dead gaps) */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center shrink-0">
        <span className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          {filteredTables.length} of {tables.length} tables active
        </span>
      </div>
    </div>
  );
};

export default MasterTableNav;
