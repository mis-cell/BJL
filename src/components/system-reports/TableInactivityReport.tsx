import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Database,
  Search,
  RefreshCcw,
  Download,
  ShieldAlert,
  Inbox,
  ArrowUpDown,
  Calendar,
  Layers,
  Activity,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TABLES, TableDef } from '../admin-desk/adminDeskTypes';

export interface ModuleInactivityStatus {
  tableName: string;
  moduleName: string;
  category: string;
  description: string;
  pk: string;
  totalRows: number;
  lastInsertDate: Date | null;
  lastInsertFormatted: string;
  recentInsertsLast3Days: number;
  isInactive: boolean; // True if no user activity in last 3 days
  daysInactive: number | null; // Number of days since last insert/activity
  status: 'INACTIVE_3DAYS' | 'ACTIVE_3DAYS' | 'EMPTY';
  isRequired16: boolean;
}

export interface ModuleDefinition {
  tableName: string;
  moduleName: string;
  category: string;
  description: string;
  isCore: boolean;
}

// Map database tables to friendly user-facing Application Modules
export const USER_MODULE_MAP: Record<string, ModuleDefinition> = {
  sauda_master: {
    tableName: 'sauda_master',
    moduleName: 'Sauda Contract Desk',
    category: 'Procurement & Sauda',
    description: 'Master purchase contract creation and supplier trade agreements',
    isCore: true
  },
  sauda_check_point: {
    tableName: 'sauda_check_point',
    moduleName: 'Sauda Checkpoint Verification',
    category: 'Procurement & Sauda',
    description: 'Contract validation, quantity limits, and approval checkpoints',
    isCore: true
  },
  purchase_master: {
    tableName: 'purchase_master',
    moduleName: 'Purchase Order (P.O.) Generation',
    category: 'Purchase Orders',
    description: 'Official P.O. issuance, rates, and purchasing terms',
    isCore: true
  },
  temporary_material_received: {
    tableName: 'temporary_material_received',
    moduleName: 'Temporary Material Arrival (Amad Gate-In)',
    category: 'Material Inward & Gate',
    description: 'Initial truck inward registration and temporary gate slip issue',
    isCore: true
  },
  final_arrival: {
    tableName: 'final_arrival',
    moduleName: 'Final Material Arrival & Gate Pass',
    category: 'Material Inward & Gate',
    description: 'Vehicle inward confirmation, gross weighment link, and gate pass',
    isCore: true
  },
  lorry_weighments: {
    tableName: 'lorry_weighments',
    moduleName: 'Weighbridge & Lorry Operations',
    category: 'Weighbridge & Logistics',
    description: 'Electric weighbridge gross, tare, and net weighment records',
    isCore: true
  },
  inspection_master: {
    tableName: 'inspection_master',
    moduleName: 'Quality Inspection Parameters & Setup',
    category: 'Quality Control',
    description: 'Quality standards, moisture thresholds, and deduction master rules',
    isCore: true
  },
  material_inspection: {
    tableName: 'material_inspection',
    moduleName: 'Material Quality Testing & Deductions',
    category: 'Quality Control',
    description: 'Lab test result entry, moisture, oil content, and claim slips',
    isCore: true
  },
  material_mismatch: {
    tableName: 'material_mismatch',
    moduleName: 'Material Discrepancy & Claims Resolution',
    category: 'Quality Control',
    description: 'Quality / quantity discrepancy logging and claim settlements',
    isCore: true
  },
  m_r_settlement: {
    tableName: 'm_r_settlement',
    moduleName: 'MR Settlement & Accounts Payment Desk',
    category: 'Settlements & Accounts',
    description: 'Material receipt bill settlement, debit/credit notes, and vouchers',
    isCore: true
  },
  satta_master: {
    tableName: 'satta_master',
    moduleName: 'Satta Trade Contract Master',
    category: 'Satta Trading',
    description: 'Satta trade register, party contracts, and transaction logs',
    isCore: true
  },
  satta_base_rates: {
    tableName: 'satta_base_rates',
    moduleName: 'Satta Daily Base Rate Maintenance',
    category: 'Satta Trading',
    description: 'Daily benchmark base market rate updates for price variance',
    isCore: true
  },
  satta_mismatch: {
    tableName: 'satta_mismatch',
    moduleName: 'Satta Rate Mismatch Resolution',
    category: 'Satta Trading',
    description: 'Discrepancy resolution between agreed Satta rates vs market rates',
    isCore: true
  },
  sms_sauda: {
    tableName: 'sms_sauda',
    moduleName: 'SMS Sauda Mobile Integration',
    category: 'Automation & Mobile',
    description: 'Automated trade contract parsing received via mobile SMS',
    isCore: true
  },
  imap_emails: {
    tableName: 'imap_emails',
    moduleName: 'IMAP Automated Email Ingestion',
    category: 'Automation & Mobile',
    description: 'Automatic email ingestion for trade advice and purchase advice',
    isCore: true
  },
  mail_logs: {
    tableName: 'mail_logs',
    moduleName: 'Mail & Communication Audit Logs',
    category: 'Automation & Mobile',
    description: 'Outbound email notifications, dispatch slips, and delivery logs',
    isCore: true
  },
  user_activity_logs: {
    tableName: 'user_activity_logs',
    moduleName: 'User Activity & Audit Tracker',
    category: 'System & Governance',
    description: 'Tracks user actions, field-level changes, and module access',
    isCore: false
  },
  user_master: {
    tableName: 'user_master',
    moduleName: 'User Management & Access Control',
    category: 'System & Governance',
    description: 'System user accounts, roles, permissions, and status',
    isCore: false
  },
  app_audit_logs: {
    tableName: 'app_audit_logs',
    moduleName: 'Application System Audit Logs',
    category: 'System & Governance',
    description: 'System security events, login attempts, and error logs',
    isCore: false
  }
};

export const TARGET_REQUIRED_TABLES = Object.keys(USER_MODULE_MAP).filter(
  key => USER_MODULE_MAP[key].isCore
);

export const TableInactivityReport: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [statuses, setStatuses] = useState<ModuleInactivityStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INACTIVE' | 'ACTIVE' | 'EMPTY' | 'CORE_16'>('INACTIVE');
  const [sortField, setSortField] = useState<'moduleName' | 'lastInsert' | 'daysInactive' | 'totalRows'>('daysInactive');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // Scan all application modules for inactivity
  const scanModulesInactivity = async () => {
    setLoading(true);
    try {
      let allTableDefs: TableDef[] = [...TABLES];

      // Ensure all core modules exist in definition list
      TARGET_REQUIRED_TABLES.forEach(reqName => {
        if (!allTableDefs.some(t => t.name === reqName)) {
          allTableDefs.push({
            name: reqName,
            label: USER_MODULE_MAP[reqName]?.moduleName || reqName.replace(/_/g, ' ').toUpperCase(),
            icon: Database,
            pk: reqName.endsWith('_id') ? reqName : 'id'
          });
        }
      });

      if (supabase) {
        try {
          const { data: dbTables } = await supabase.rpc('get_all_tables');
          if (Array.isArray(dbTables) && dbTables.length > 0) {
            dbTables.forEach((tName: string) => {
              if (
                typeof tName === 'string' &&
                !tName.startsWith('pg_') &&
                !tName.startsWith('sql_') &&
                !tName.startsWith('temp_') &&
                !allTableDefs.some(t => t.name === tName)
              ) {
                allTableDefs.push({
                  name: tName,
                  label: tName.replace(/_/g, ' ').toUpperCase(),
                  icon: Database,
                  pk: tName === 'user_master' ? 'user_id' : tName.endsWith('_id') ? tName : 'id'
                });
              }
            });
          }
        } catch (e) {
          // Ignore missing RPC
        }
      }

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const results: ModuleInactivityStatus[] = [];

      for (const tDef of allTableDefs) {
        let totalCount = 0;
        let maxDate: Date | null = null;
        let recent3DaysCount = 0;

        if (supabase) {
          try {
            const { count } = await supabase
              .from(tDef.name)
              .select('*', { count: 'exact', head: true });
            totalCount = count || 0;

            if (totalCount > 0) {
              const candidateCols = [
                'created_at',
                'timestamp',
                'created_date',
                'date',
                'entry_date',
                'updated_at',
                'logged_at',
                'time_stamp'
              ];

              let dateFound = false;

              for (const col of candidateCols) {
                try {
                  const { data: latestRecords, error: colErr } = await supabase
                    .from(tDef.name)
                    .select(col)
                    .not(col, 'is', null)
                    .order(col, { ascending: false })
                    .limit(1);

                  if (!colErr && latestRecords && latestRecords.length > 0) {
                    const rawVal = latestRecords[0][col];
                    if (rawVal) {
                      const d = new Date(rawVal);
                      if (!isNaN(d.getTime())) {
                        maxDate = d;
                        dateFound = true;

                        try {
                          const { count: c3 } = await supabase
                            .from(tDef.name)
                            .select('*', { count: 'exact', head: true })
                            .gte(col, threeDaysAgo.toISOString());
                          recent3DaysCount = c3 || 0;
                        } catch (err) {
                          recent3DaysCount = d >= threeDaysAgo ? 1 : 0;
                        }
                        break;
                      }
                    }
                  }
                } catch (e) {
                  // Column not present, check next
                }
              }

              // Fallback to user_activity_logs
              if (!dateFound) {
                try {
                  const { data: actLogs } = await supabase
                    .from('user_activity_logs')
                    .select('created_at')
                    .ilike('module_name', `%${tDef.name}%`)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  if (actLogs && actLogs.length > 0 && actLogs[0].created_at) {
                    const d = new Date(actLogs[0].created_at);
                    if (!isNaN(d.getTime())) {
                      maxDate = d;
                      recent3DaysCount = d >= threeDaysAgo ? 1 : 0;
                    }
                  }
                } catch (e) {
                  // Ignore
                }
              }
            }
          } catch (err) {
            // Permission or missing table
          }
        }

        // Get friendly module info or generate intelligent defaults
        const mapped = USER_MODULE_MAP[tDef.name];
        const moduleName = mapped?.moduleName || tDef.label || tDef.name.replace(/_/g, ' ').toUpperCase();
        let category = mapped?.category || 'General Operations';
        const description = mapped?.description || `Operations & transactions managed in ${moduleName}`;

        if (!mapped) {
          if (tDef.name.includes('sauda')) category = 'Procurement & Sauda';
          else if (tDef.name.includes('satta')) category = 'Satta Trading';
          else if (tDef.name.includes('purchase') || tDef.name.includes('po')) category = 'Purchase Orders';
          else if (tDef.name.includes('material') || tDef.name.includes('amad') || tDef.name.includes('arrival')) category = 'Material Inward & Gate';
          else if (tDef.name.includes('inspection') || tDef.name.includes('mill')) category = 'Quality Control';
          else if (tDef.name.includes('settlement') || tDef.name.includes('payment') || tDef.name.includes('ledger')) category = 'Settlements & Accounts';
          else if (tDef.name.includes('godown') || tDef.name.includes('stock') || tDef.name.includes('issue')) category = 'Inventory & Stock';
          else if (tDef.name.includes('user') || tDef.name.includes('audit') || tDef.name.includes('log')) category = 'System & Governance';
        }

        // Calculate inactivity metrics
        let daysInactive: number | null = null;
        let isInactive = false;
        let status: ModuleInactivityStatus['status'] = 'INACTIVE_3DAYS';

        if (totalCount === 0) {
          status = 'EMPTY';
          isInactive = true;
          daysInactive = 999;
        } else if (!maxDate) {
          status = 'INACTIVE_3DAYS';
          isInactive = true;
          daysInactive = 999;
        } else {
          const diffMs = new Date().getTime() - maxDate.getTime();
          daysInactive = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

          if (recent3DaysCount > 0 || maxDate >= threeDaysAgo) {
            status = 'ACTIVE_3DAYS';
            isInactive = false;
          } else {
            status = 'INACTIVE_3DAYS';
            isInactive = true;
          }
        }

        let lastInsertFormatted = 'No User Activity Recorded';
        if (maxDate) {
          lastInsertFormatted = maxDate.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        }

        const isRequired16 = TARGET_REQUIRED_TABLES.includes(tDef.name);

        results.push({
          tableName: tDef.name,
          moduleName,
          category,
          description,
          pk: tDef.pk,
          totalRows: totalCount,
          lastInsertDate: maxDate,
          lastInsertFormatted,
          recentInsertsLast3Days: recent3DaysCount,
          isInactive,
          daysInactive,
          status,
          isRequired16
        });
      }

      setStatuses(results);
      setLastScanTime(new Date());
    } catch (err) {
      console.error('Error scanning module inactivity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanModulesInactivity();
  }, []);

  // Filter & Search
  const filteredStatuses = useMemo(() => {
    return statuses.filter(item => {
      if (statusFilter === 'INACTIVE' && !item.isInactive) return false;
      if (statusFilter === 'ACTIVE' && item.isInactive) return false;
      if (statusFilter === 'EMPTY' && item.status !== 'EMPTY') return false;
      if (statusFilter === 'CORE_16' && !item.isRequired16) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.moduleName.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesTable = item.tableName.toLowerCase().includes(q);
        return matchesName || matchesCategory || matchesDesc || matchesTable;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'lastInsert') {
        valA = a.lastInsertDate ? a.lastInsertDate.getTime() : 0;
        valB = b.lastInsertDate ? b.lastInsertDate.getTime() : 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [statuses, statusFilter, searchTerm, sortField, sortAsc]);

  // Key Metrics
  const metrics = useMemo(() => {
    const total = statuses.length;
    const inactive = statuses.filter(s => s.isInactive).length;
    const active = statuses.filter(s => !s.isInactive).length;
    const empty = statuses.filter(s => s.status === 'EMPTY').length;
    const coreTotal = statuses.filter(s => s.isRequired16).length;
    const coreInactive = statuses.filter(s => s.isRequired16 && s.isInactive).length;

    // List of core inactive module names
    const inactiveModuleNames = statuses
      .filter(s => s.isInactive)
      .map(s => s.moduleName);

    return { total, inactive, active, empty, coreTotal, coreInactive, inactiveModuleNames };
  }, [statuses]);

  // Export CSV
  const handleExportCSV = () => {
    if (statuses.length === 0) return;

    const headers = [
      'User Module Name',
      'Category',
      'Functional Description',
      'Status (Last 3 Days)',
      'Last User Activity Date',
      'Days Inactive',
      '3-Day Operations Count',
      'Total Records',
      'System Table Name'
    ];

    const rows = filteredStatuses.map(s => [
      `"${s.moduleName}"`,
      `"${s.category}"`,
      `"${s.description}"`,
      `"${s.isInactive ? 'INACTIVE (No activity in 3+ days)' : 'ACTIVE (Used recently)'}"`,
      `"${s.lastInsertFormatted}"`,
      s.daysInactive === 999 ? 'Never / N/A' : `${s.daysInactive} days`,
      s.recentInsertsLast3Days,
      s.totalRows,
      `"${s.tableName}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Module_Inactivity_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field: 'moduleName' | 'lastInsert' | 'daysInactive' | 'totalRows') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* HEADER TITLE CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-6 rounded-3xl border border-rose-900/50 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" /> Management Analysis #10
            </span>
            <span className="text-xs text-slate-400">User Module Governance</span>
          </div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-rose-400" />
            User Module Inactivity Analysis (Last 3 Days)
          </h2>
          <p className="text-xs text-rose-200/80 max-w-2xl">
            Monitors all <strong className="text-white">user-facing application modules</strong> to detect which modules have had <strong className="text-amber-300">NO user activity, entries, or operations in the last 3 days (72 hours)</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={scanModulesInactivity}
            disabled={loading}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-2xl border border-rose-400/40 transition flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Scanning Modules...' : 'Re-Scan System'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={statuses.length === 0}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-2xl border border-amber-300 transition flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* EXECUTIVE ALERT BANNER FOR INACTIVE MODULES */}
      {!loading && metrics.inactive > 0 && (
        <div className="bg-rose-950/90 border border-rose-700/60 rounded-3xl p-5 text-rose-100 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm text-rose-300">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
              <span>🚨 INACTIVE MODULES DETECTED (NO USER ACTIVITY IN 3 DAYS)</span>
            </div>
            <span className="px-3 py-1 bg-rose-900/80 rounded-full text-xs font-mono font-bold text-rose-200 border border-rose-600">
              {metrics.inactive} Modules Inactive
            </span>
          </div>

          <p className="text-xs text-rose-200/90">
            The following functional modules have not recorded any user activity or transaction entries in the last 72 hours:
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {metrics.inactiveModuleNames.slice(0, 10).map((mName, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-black/40 border border-rose-500/40 text-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {mName}
              </span>
            ))}
            {metrics.inactiveModuleNames.length > 10 && (
              <span className="px-2.5 py-1 bg-rose-900/50 text-rose-300 text-xs font-bold rounded-xl">
                +{metrics.inactiveModuleNames.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* TOTAL MODULES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Total Application Modules
            </span>
            <span className="text-2xl font-black text-white font-mono mt-0.5 block">
              {metrics.total}
            </span>
            <span className="text-[10px] text-slate-500">Tracked Application Features</span>
          </div>
          <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
            <Layers className="w-6 h-6 text-slate-300" />
          </div>
        </div>

        {/* INACTIVE MODULES */}
        <div
          onClick={() => setStatusFilter('INACTIVE')}
          className={`cursor-pointer transition border rounded-2xl p-4 shadow-sm flex items-center justify-between ${
            statusFilter === 'INACTIVE'
              ? 'bg-rose-950/80 border-rose-600 text-rose-100 ring-2 ring-rose-500/50'
              : 'bg-slate-900 border-rose-900/40 hover:border-rose-700 text-white'
          }`}
        >
          <div>
            <span className="text-[11px] text-rose-300 font-bold uppercase tracking-wider block flex items-center gap-1">
              🔴 Inactive Modules (3d+)
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-0.5 block">
              {metrics.inactive}
            </span>
            <span className="text-[10px] text-rose-300/80">No user work in 72 hours</span>
          </div>
          <div className="p-3 bg-rose-900/40 rounded-xl border border-rose-700/50">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
        </div>

        {/* ACTIVE MODULES */}
        <div
          onClick={() => setStatusFilter('ACTIVE')}
          className={`cursor-pointer transition border rounded-2xl p-4 shadow-sm flex items-center justify-between ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-950/80 border-emerald-600 text-emerald-100 ring-2 ring-emerald-500/50'
              : 'bg-slate-900 border-emerald-900/40 hover:border-emerald-700 text-white'
          }`}
        >
          <div>
            <span className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider block flex items-center gap-1">
              🟢 Active Modules (3d)
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
              {metrics.active}
            </span>
            <span className="text-[10px] text-emerald-300/80">Active work in last 3 days</span>
          </div>
          <div className="p-3 bg-emerald-900/40 rounded-xl border border-emerald-700/50">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* UNUSED / EMPTY MODULES */}
        <div
          onClick={() => setStatusFilter('EMPTY')}
          className={`cursor-pointer transition border rounded-2xl p-4 shadow-sm flex items-center justify-between ${
            statusFilter === 'EMPTY'
              ? 'bg-amber-950/80 border-amber-600 text-amber-100 ring-2 ring-amber-500/50'
              : 'bg-slate-900 border-amber-900/40 hover:border-amber-700 text-white'
          }`}
        >
          <div>
            <span className="text-[11px] text-amber-300 font-bold uppercase tracking-wider block flex items-center gap-1">
              ⚠️ Unused / Empty Modules
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-0.5 block">
              {metrics.empty}
            </span>
            <span className="text-[10px] text-amber-300/80">0 records in database</span>
          </div>
          <div className="p-3 bg-amber-900/40 rounded-xl border border-amber-700/50">
            <Inbox className="w-6 h-6 text-amber-400" />
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-inner">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-slate-800 text-xs w-full md:w-auto overflow-x-auto">
          {[
            { id: 'INACTIVE' as const, label: `🔴 Inactive Modules (${metrics.inactive})`, activeBg: 'bg-rose-600 text-white' },
            { id: 'CORE_16' as const, label: `🎯 16 Core Modules (${metrics.coreInactive}/${metrics.coreTotal} Inactive)`, activeBg: 'bg-indigo-600 text-white' },
            { id: 'ACTIVE' as const, label: `🟢 Active Modules (${metrics.active})`, activeBg: 'bg-emerald-600 text-white' },
            { id: 'EMPTY' as const, label: `⚠️ Unused Modules (${metrics.empty})`, activeBg: 'bg-amber-500 text-slate-950' },
            { id: 'ALL' as const, label: `📋 All Modules (${metrics.total})`, activeBg: 'bg-slate-700 text-white' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? `${tab.activeBg} shadow-md`
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search module name or category..."
            className="w-full bg-slate-950 border border-slate-800 text-white text-xs pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:border-rose-500 transition placeholder-slate-500"
          />
        </div>
      </div>

      {/* DETAILED USER MODULE INACTIVITY GRID */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <RefreshCcw className="w-10 h-10 animate-spin text-rose-600 mx-auto" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Analyzing Application Modules for User Inactivity...
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Checking user transaction timestamps across all core business modules, quality inspections, and settlement desks.
            </p>
          </div>
        ) : filteredStatuses.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Matching Modules Found</h3>
            <p className="text-xs text-slate-500">
              Try clearing your search term or selecting a different status filter above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5 text-center w-12">#</th>
                  <th
                    className="p-3.5 cursor-pointer hover:text-white"
                    onClick={() => toggleSort('moduleName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>User Application Module</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="p-3.5">Category / Function</th>
                  <th
                    className="p-3.5 text-center cursor-pointer hover:text-white"
                    onClick={() => toggleSort('daysInactive')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Activity Status (Last 3 Days)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-left cursor-pointer hover:text-white"
                    onClick={() => toggleSort('lastInsert')}
                  >
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Last User Activity Date</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:text-white"
                    onClick={() => toggleSort('totalRows')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Records</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStatuses.map((item, idx) => {
                  return (
                    <tr
                      key={item.tableName}
                      className={`transition ${
                        item.isInactive
                          ? 'bg-rose-50/40 hover:bg-rose-50/90'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Index */}
                      <td className="p-3.5 text-center font-mono text-slate-400 font-bold text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Module Name & Description */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">
                              {item.moduleName}
                            </span>
                            {item.isRequired16 && (
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 text-[9px] font-extrabold rounded-md uppercase">
                                Core Module
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {item.description}
                          </p>
                          <div className="text-[9px] text-slate-400 font-mono">
                            System Table: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{item.tableName}</code>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-[10px] inline-block">
                          {item.category}
                        </span>
                      </td>

                      {/* Activity Status */}
                      <td className="p-3.5 text-center">
                        {item.status === 'EMPTY' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px] inline-flex items-center gap-1">
                            <Inbox className="w-3 h-3 text-amber-600" />
                            Unused (0 Records)
                          </span>
                        ) : item.isInactive ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            🔴 Inactive ({item.daysInactive === 999 ? '3+ Days' : `${item.daysInactive}d Inactive`})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            🟢 Active ({item.recentInsertsLast3Days} ops in 3d)
                          </span>
                        )}
                      </td>

                      {/* Last User Activity Date */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <span className={`font-mono font-bold block text-[11px] ${
                            item.lastInsertDate ? 'text-slate-800' : 'text-slate-400 italic'
                          }`}>
                            {item.lastInsertFormatted}
                          </span>
                          {item.lastInsertDate && (
                            <span className="text-[10px] text-slate-400 block">
                              {item.daysInactive === 0 ? 'Today' : item.daysInactive === 1 ? 'Yesterday' : `${item.daysInactive} days ago`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Records */}
                      <td className="p-3.5 text-right font-mono font-black text-slate-800 text-xs">
                        {item.totalRows.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER SUMMARY */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-slate-500 text-xs flex flex-col md:flex-row items-center justify-between gap-2">
          <span>
            Showing <strong className="text-slate-800">{filteredStatuses.length}</strong> of{' '}
            <strong className="text-slate-800">{statuses.length}</strong> modules
          </span>

          <span className="text-[10px] text-slate-400">
            Audit scanned at: {lastScanTime ? lastScanTime.toLocaleTimeString('en-IN') : '-'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TableInactivityReport;
