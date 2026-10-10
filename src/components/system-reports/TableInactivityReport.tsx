import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Database,
  Search,
  RefreshCcw,
  Download,
  Calendar,
  Layers
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
  isInactive: boolean;
  daysInactive: number | null;
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

// 16 Core Tables Map
export const USER_MODULE_MAP: Record<string, ModuleDefinition> = {
  sauda_master: {
    tableName: 'sauda_master',
    moduleName: 'Sauda Contract Desk',
    category: 'Procurement & Sauda',
    description: 'Master purchase contract creation and trade agreements',
    isCore: true
  },
  sauda_check_point: {
    tableName: 'sauda_check_point',
    moduleName: 'Sauda Checkpoint Verification',
    category: 'Procurement & Sauda',
    description: 'Contract validation and approval checkpoints',
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
    moduleName: 'Quality Inspection Setup',
    category: 'Quality Control',
    description: 'Quality standards and moisture deduction master rules',
    isCore: true
  },
  material_inspection: {
    tableName: 'material_inspection',
    moduleName: 'Material Quality Testing & Deductions',
    category: 'Quality Control',
    description: 'Lab test result entry, moisture, and claim slips',
    isCore: true
  },
  material_mismatch: {
    tableName: 'material_mismatch',
    moduleName: 'Material Discrepancy & Claims',
    category: 'Quality Control',
    description: 'Quality/quantity discrepancy logging and settlements',
    isCore: true
  },
  m_r_settlement: {
    tableName: 'm_r_settlement',
    moduleName: 'MR Settlement & Accounts Desk',
    category: 'Settlements & Accounts',
    description: 'Material receipt bill settlement and debit/credit notes',
    isCore: true
  },
  satta_master: {
    tableName: 'satta_master',
    moduleName: 'Satta Trade Contract Master',
    category: 'Satta Trading',
    description: 'Satta trade register and party contracts',
    isCore: true
  },
  satta_base_rates: {
    tableName: 'satta_base_rates',
    moduleName: 'Satta Base Rate Maintenance',
    category: 'Satta Trading',
    description: 'Daily benchmark market base rate updates',
    isCore: true
  },
  satta_mismatch: {
    tableName: 'satta_mismatch',
    moduleName: 'Satta Rate Mismatch Resolution',
    category: 'Satta Trading',
    description: 'Discrepancy resolution between agreed Satta rates vs market',
    isCore: true
  },
  sms_sauda: {
    tableName: 'sms_sauda',
    moduleName: 'SMS Sauda Integration',
    category: 'Automation & Mobile',
    description: 'Automated trade contract parsing from SMS',
    isCore: true
  },
  imap_emails: {
    tableName: 'imap_emails',
    moduleName: 'IMAP Email Ingestion',
    category: 'Automation & Mobile',
    description: 'Automatic email ingestion for trade advice',
    isCore: true
  },
  mail_logs: {
    tableName: 'mail_logs',
    moduleName: 'Mail Communication Audit Logs',
    category: 'Automation & Mobile',
    description: 'Outbound email notifications and delivery logs',
    isCore: true
  }
};

export const TARGET_REQUIRED_TABLES = Object.keys(USER_MODULE_MAP);

export const TableInactivityReport: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [statuses, setStatuses] = useState<ModuleInactivityStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'INACTIVE' | 'ACTIVE' | 'ALL'>('INACTIVE');
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // Scan modules for last 3 days activity
  const scanModulesInactivity = async () => {
    setLoading(true);
    try {
      let allTableDefs: TableDef[] = [...TABLES];

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
          // Ignore
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

        const mapped = USER_MODULE_MAP[tDef.name];
        const moduleName = mapped?.moduleName || tDef.label || tDef.name.replace(/_/g, ' ').toUpperCase();
        let category = mapped?.category || 'General Operations';
        const description = mapped?.description || `Operations in ${moduleName}`;

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

        let lastInsertFormatted = 'No Activity Recorded';
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

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.moduleName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.tableName.toLowerCase().includes(q)
        );
      }

      return true;
    }).sort((a, b) => {
      // Sort inactive first, then by days inactive descending
      if (a.isInactive !== b.isInactive) return a.isInactive ? -1 : 1;
      return (b.daysInactive || 0) - (a.daysInactive || 0);
    });
  }, [statuses, statusFilter, searchTerm]);

  // Key Metrics
  const metrics = useMemo(() => {
    const total = statuses.length;
    const inactive = statuses.filter(s => s.isInactive).length;
    const active = statuses.filter(s => !s.isInactive).length;
    return { total, inactive, active };
  }, [statuses]);

  // Export CSV
  const handleExportCSV = () => {
    if (statuses.length === 0) return;

    const headers = [
      'Module Name',
      'Category',
      'Status (Last 3 Days)',
      'Last User Activity Date',
      'Days Inactive',
      'System Table'
    ];

    const rows = filteredStatuses.map(s => [
      `"${s.moduleName}"`,
      `"${s.category}"`,
      `"${s.isInactive ? 'NOT USED IN LAST 3 DAYS' : 'ACTIVE'}"`,
      `"${s.lastInsertFormatted}"`,
      s.daysInactive === 999 ? 'Never / N/A' : `${s.daysInactive} days`,
      `"${s.tableName}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Module_Inactivity_3Days_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">
      
      {/* SIMPLE CLEAN HEADER */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-[10px] uppercase tracking-wide">
              Module Inactivity Analysis
            </span>
            {lastScanTime && (
              <span className="text-[11px] text-slate-400 font-mono">
                Updated: {lastScanTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-600" />
            Modules Not Used In Last 3 Days
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Simple status check showing which system modules have recorded <strong>no user activity</strong> in the last 72 hours.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={scanModulesInactivity}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={statuses.length === 0}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl border border-amber-300 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* INACTIVE MODULES CARD */}
        <div
          onClick={() => setStatusFilter('INACTIVE')}
          className={`cursor-pointer p-4 rounded-2xl border transition shadow-xs flex items-center justify-between ${
            statusFilter === 'INACTIVE'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/50'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-extrabold text-rose-700 uppercase tracking-wider block">
              🔴 Not Used (Last 3 Days)
            </span>
            <span className="text-2xl font-black text-rose-900 font-mono mt-0.5 block">
              {metrics.inactive} Modules
            </span>
            <span className="text-[10px] text-rose-600 font-medium">No activity in 72h</span>
          </div>
          <div className="p-3 bg-rose-100 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
        </div>

        {/* ACTIVE MODULES CARD */}
        <div
          onClick={() => setStatusFilter('ACTIVE')}
          className={`cursor-pointer p-4 rounded-2xl border transition shadow-xs flex items-center justify-between ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/50'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider block">
              🟢 Active (Used in 3 Days)
            </span>
            <span className="text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
              {metrics.active} Modules
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Recorded user work</span>
          </div>
          <div className="p-3 bg-emerald-100 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* TOTAL MODULES CARD */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition shadow-xs flex items-center justify-between ${
            statusFilter === 'ALL'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/50'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
              📋 Total Modules Monitored
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
              {metrics.total} Modules
            </span>
            <span className="text-[10px] text-slate-500 font-medium">All application features</span>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl">
            <Layers className="w-5 h-5 text-slate-600" />
          </div>
        </div>
      </div>

      {/* SEARCH AND SIMPLE FILTER BAR */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
              statusFilter === 'INACTIVE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🔴 Not Used ({metrics.inactive})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🟢 Active ({metrics.active})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📋 All ({metrics.total})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search module name..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-rose-500 transition"
          />
        </div>
      </div>

      {/* SIMPLE CLEAN TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCcw className="w-8 h-8 animate-spin text-rose-600 mx-auto" />
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Checking last 3 days user activity...
            </p>
          </div>
        ) : filteredStatuses.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Inactive Modules Found</h3>
            <p className="text-xs text-slate-500">All modules have had user activity in the last 3 days!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">User Module Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">3-Day Status</th>
                  <th className="p-3">Last User Activity Date</th>
                  <th className="p-3 text-center">Inactivity Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStatuses.map((item, idx) => (
                  <tr
                    key={item.tableName}
                    className={`transition ${
                      item.isInactive ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-3 text-center font-mono text-slate-400 font-bold text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="p-3">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 text-xs block">
                          {item.moduleName}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {item.description}
                        </span>
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px] inline-block border border-slate-200">
                        {item.category}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      {item.isInactive ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-black text-[10px] inline-flex items-center gap-1">
                          🔴 Not Used (Last 3 Days)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10px] inline-flex items-center gap-1">
                          🟢 Active
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1 text-slate-700 font-mono text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.lastInsertFormatted}</span>
                      </div>
                    </td>

                    <td className="p-3 text-center font-mono text-xs font-extrabold text-slate-700">
                      {item.daysInactive === null || item.daysInactive === 999
                        ? 'No Activity'
                        : item.daysInactive === 0
                        ? 'Active Today'
                        : `${item.daysInactive} Days Inactive`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
          <span>Showing <strong>{filteredStatuses.length}</strong> modules</span>
          <span className="font-mono text-slate-400">Section: 10. Inactivity</span>
        </div>
      </div>

    </div>
  );
};

export default TableInactivityReport;
