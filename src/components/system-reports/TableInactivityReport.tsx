import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Database,
  Search,
  RefreshCcw,
  Download,
  Filter,
  Layers,
  ShieldAlert,
  Inbox,
  ArrowUpDown,
  Calendar,
  FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TABLES, TableDef } from '../admin-desk/adminDeskTypes';

export interface TableInactivityStatus {
  tableName: string;
  label: string;
  category: string;
  pk: string;
  totalRows: number;
  lastInsertDate: Date | null;
  lastInsertFormatted: string;
  recentInsertsLast3Days: number;
  isInactive: boolean; // True if no insertion in last 3 days
  daysInactive: number | null; // Number of days since last insert
  status: 'INACTIVE_3DAYS' | 'ACTIVE_3DAYS' | 'EMPTY';
  isRequired16: boolean;
}

export const TARGET_REQUIRED_TABLES = [
  'final_arrival',
  'imap_emails',
  'inspection_master',
  'lorry_weighments',
  'm_r_settlement',
  'mail_logs',
  'material_inspection',
  'material_mismatch',
  'purchase_master',
  'satta_base_rates',
  'satta_master',
  'satta_mismatch',
  'sauda_check_point',
  'sauda_master',
  'sms_sauda',
  'temporary_material_received'
];

export const TableInactivityReport: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [statuses, setStatuses] = useState<TableInactivityStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INACTIVE' | 'ACTIVE' | 'EMPTY' | 'REQUIRED_16'>('INACTIVE');
  const [sortField, setSortField] = useState<'tableName' | 'lastInsert' | 'daysInactive' | 'totalRows'>('daysInactive');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // Scan all database tables for inactivity
  const scanTablesInactivity = async () => {
    setLoading(true);
    try {
      // 1. Gather master list of tables (Predefined + dynamic from Supabase)
      let allTableDefs: TableDef[] = [...TABLES];

      // Ensure all 16 required tables exist in allTableDefs
      TARGET_REQUIRED_TABLES.forEach(reqName => {
        if (!allTableDefs.some(t => t.name === reqName)) {
          allTableDefs.push({
            name: reqName,
            label: reqName.replace(/_/g, ' ').toUpperCase(),
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
          // Ignore RPC missing error
        }
      }

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const results: TableInactivityStatus[] = [];

      // Helper function to inspect a single table
      for (const tDef of allTableDefs) {
        let totalCount = 0;
        let maxDate: Date | null = null;
        let recent3DaysCount = 0;

        if (supabase) {
          try {
            // Check total count
            const { count } = await supabase
              .from(tDef.name)
              .select('*', { count: 'exact', head: true });
            totalCount = count || 0;

            if (totalCount > 0) {
              // Try fetching most recent records with various date candidate columns
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

                        // Count records in last 3 days for this date column
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
                  // Column doesn't exist on table, try next candidate
                }
              }

              // Fallback: If no explicit date column exists, check user_activity_logs or app_audit_logs for this table
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
            // Table might not exist in Supabase yet or permission issue
          }
        }

        // Categorize table module
        let category = 'Master / System';
        if (tDef.name.includes('sauda')) category = 'Sauda Desk';
        else if (tDef.name.includes('satta')) category = 'Satta Desk';
        else if (tDef.name.includes('purchase') || tDef.name.includes('po')) category = 'P.O. Desk';
        else if (tDef.name.includes('material') || tDef.name.includes('amad') || tDef.name.includes('arrival')) category = 'Material Inward';
        else if (tDef.name.includes('inspection') || tDef.name.includes('mill')) category = 'Inspection';
        else if (tDef.name.includes('settlement') || tDef.name.includes('payment') || tDef.name.includes('ledger')) category = 'Settlement & Accounts';
        else if (tDef.name.includes('godown') || tDef.name.includes('stock') || tDef.name.includes('issue')) category = 'Godown & Inventory';
        else if (tDef.name.includes('user') || tDef.name.includes('audit') || tDef.name.includes('log')) category = 'Auth & Activity';

        // Calculate days inactive
        let daysInactive: number | null = null;
        let isInactive = false;
        let status: TableInactivityStatus['status'] = 'INACTIVE_3DAYS';

        if (totalCount === 0) {
          status = 'EMPTY';
          isInactive = true;
          daysInactive = 999; // Represents never inserted
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

        // Format date string
        let lastInsertFormatted = 'No Data Inserted';
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
          label: tDef.label,
          category,
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
      console.error('Error scanning table inactivity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanTablesInactivity();
  }, []);

  // Filter & Search
  const filteredStatuses = useMemo(() => {
    return statuses.filter(item => {
      // Status filter
      if (statusFilter === 'INACTIVE' && !item.isInactive) return false;
      if (statusFilter === 'ACTIVE' && item.isInactive) return false;
      if (statusFilter === 'EMPTY' && item.status !== 'EMPTY') return false;
      if (statusFilter === 'REQUIRED_16' && !item.isRequired16) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.tableName.toLowerCase().includes(q);
        const matchesLabel = item.label.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        return matchesName || matchesLabel || matchesCategory;
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

  // Metrics
  const metrics = useMemo(() => {
    const total = statuses.length;
    const inactive = statuses.filter(s => s.isInactive).length;
    const active = statuses.filter(s => !s.isInactive).length;
    const empty = statuses.filter(s => s.status === 'EMPTY').length;
    const req16Total = statuses.filter(s => s.isRequired16).length;
    const req16Inactive = statuses.filter(s => s.isRequired16 && s.isInactive).length;
    return { total, inactive, active, empty, req16Total, req16Inactive };
  }, [statuses]);

  // Export CSV
  const handleExportCSV = () => {
    if (statuses.length === 0) return;

    const headers = [
      'Table Name',
      'Display Label',
      'Category',
      'Status (Last 3 Days)',
      'Total Rows',
      'Last Data Inserted',
      'Days Inactive',
      'Last 3 Days Inserts Count'
    ];

    const rows = filteredStatuses.map(s => [
      `"${s.tableName}"`,
      `"${s.label}"`,
      `"${s.category}"`,
      `"${s.isInactive ? 'INACTIVE (No insert in 3+ days)' : 'ACTIVE (Inserted recently)'}"`,
      s.totalRows,
      `"${s.lastInsertFormatted}"`,
      s.daysInactive === 999 ? 'Never / N/A' : `${s.daysInactive} days`,
      s.recentInsertsLast3Days
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Table_Inactivity_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field: 'tableName' | 'lastInsert' | 'daysInactive' | 'totalRows') => {
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
            <span className="text-xs text-slate-400">Database Audit & Health</span>
          </div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-rose-400" />
            Table Inactivity Report (Last 3 Days Inactivity)
          </h2>
          <p className="text-xs text-rose-200/80 max-w-2xl">
            Identifies all system database tables where <strong className="text-white">NO new data has been inserted in the last 3 days (72 hours)</strong>. Use this audit log to track dormant modules, unrecorded operations, or offline data pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={scanTablesInactivity}
            disabled={loading}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-2xl border border-rose-400/40 transition flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Scanning Tables...' : 'Re-Scan Database'}</span>
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

      {/* KPI METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* TOTAL TABLES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Total Tables Analyzed
            </span>
            <span className="text-2xl font-black text-white font-mono mt-0.5 block">
              {metrics.total}
            </span>
            <span className="text-[10px] text-slate-500">System Database Tables</span>
          </div>
          <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
            <Database className="w-6 h-6 text-slate-300" />
          </div>
        </div>

        {/* INACTIVE TABLES */}
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
              🔴 Inactive (No Insert 3d)
            </span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-0.5 block">
              {metrics.inactive}
            </span>
            <span className="text-[10px] text-rose-300/80">No activity in last 72 hours</span>
          </div>
          <div className="p-3 bg-rose-900/40 rounded-xl border border-rose-700/50">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
        </div>

        {/* ACTIVE TABLES */}
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
              🟢 Active (Inserted in 3d)
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
              {metrics.active}
            </span>
            <span className="text-[10px] text-emerald-300/80">Active in last 72 hours</span>
          </div>
          <div className="p-3 bg-emerald-900/40 rounded-xl border border-emerald-700/50">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* EMPTY TABLES */}
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
              ⚠️ Empty Tables (0 Rows)
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-0.5 block">
              {metrics.empty}
            </span>
            <span className="text-[10px] text-amber-300/80">Never inserted / 0 records</span>
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
            { id: 'INACTIVE' as const, label: `🔴 Inactive Tables (${metrics.inactive})`, activeBg: 'bg-rose-600 text-white' },
            { id: 'REQUIRED_16' as const, label: `🎯 Required 16 Tables (${metrics.req16Inactive}/${metrics.req16Total} Inactive)`, activeBg: 'bg-indigo-600 text-white' },
            { id: 'ACTIVE' as const, label: `🟢 Active Tables (${metrics.active})`, activeBg: 'bg-emerald-600 text-white' },
            { id: 'EMPTY' as const, label: `⚠️ Empty Tables (${metrics.empty})`, activeBg: 'bg-amber-500 text-slate-950' },
            { id: 'ALL' as const, label: `📋 All Tables (${metrics.total})`, activeBg: 'bg-slate-700 text-white' }
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
            placeholder="Search table name or category..."
            className="w-full bg-slate-950 border border-slate-800 text-white text-xs pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:border-rose-500 transition placeholder-slate-500"
          />
        </div>
      </div>

      {/* DETAILED TABLES INACTIVITY AUDIT GRID */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <RefreshCcw className="w-10 h-10 animate-spin text-rose-600 mx-auto" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Auditing Database Tables for Inactivity...
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Scanning record timestamps across all master tables, transaction logs, and inspection details to identify non-active modules.
            </p>
          </div>
        ) : filteredStatuses.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Matching Tables Found</h3>
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
                    onClick={() => toggleSort('tableName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Database Table Name</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="p-3.5">Category / Module</th>
                  <th
                    className="p-3.5 text-right cursor-pointer hover:text-white"
                    onClick={() => toggleSort('totalRows')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Rows</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-left cursor-pointer hover:text-white"
                    onClick={() => toggleSort('lastInsert')}
                  >
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Last Data Insertion Date</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 text-center cursor-pointer hover:text-white"
                    onClick={() => toggleSort('daysInactive')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Inactivity Duration</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="p-3.5 text-center">Inactivity Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStatuses.map((row, idx) => {
                  return (
                    <tr
                      key={row.tableName}
                      className={`hover:bg-slate-50 transition-colors ${
                        row.isInactive ? 'bg-rose-50/20' : 'bg-white'
                      }`}
                    >
                      <td className="p-3.5 text-center font-mono text-slate-400 text-[10px]">
                        {idx + 1}
                      </td>

                      <td className="p-3.5">
                        <div className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{row.tableName}</span>
                          {row.isRequired16 && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase border border-indigo-200">
                              🎯 Required
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block pl-5">
                          {row.label}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                          {row.category}
                        </span>
                      </td>

                      <td className="p-3.5 text-right font-mono font-black text-slate-900">
                        {row.totalRows.toLocaleString()}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            row.lastInsertDate ? 'text-slate-800' : 'text-slate-400 italic'
                          }`}
                        >
                          {row.lastInsertFormatted}
                        </span>
                        {row.recentInsertsLast3Days > 0 && (
                          <span className="text-[10px] text-emerald-700 font-bold block">
                            +{row.recentInsertsLast3Days} rows added in last 3 days
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        {row.status === 'EMPTY' ? (
                          <span className="text-amber-800 text-[10px] font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                            Never Inserted
                          </span>
                        ) : row.daysInactive === 0 ? (
                          <span className="text-emerald-800 text-[10px] font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                            Active Today
                          </span>
                        ) : row.daysInactive && row.daysInactive < 3 ? (
                          <span className="text-emerald-800 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                            {row.daysInactive} {row.daysInactive === 1 ? 'day' : 'days'} ago
                          </span>
                        ) : (
                          <span className="text-rose-900 text-[10px] font-black bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                            {row.daysInactive === 999 ? '3+ Days Inactive' : `${row.daysInactive} days inactive`}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {row.isInactive ? (
                          <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs">
                            <AlertTriangle className="w-3 h-3" />
                            🔴 INACTIVE (3+ Days)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            🟢 ACTIVE
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER STATS */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Showing <strong className="text-slate-800">{filteredStatuses.length}</strong> of{' '}
            <strong className="text-slate-800">{statuses.length}</strong> database tables
          </span>
          {lastScanTime && (
            <span className="text-[11px] italic">
              Last Database Scan: {lastScanTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
