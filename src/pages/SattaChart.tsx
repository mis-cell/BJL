import React, { useState, useEffect, useMemo } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { 
  TrendingUp, 
  History, 
  Search, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Calculator, 
  Settings2, 
  RefreshCcw, 
  FileSpreadsheet, 
  Save, 
  Download, 
  AlertCircle,
  ArrowRight,
  X,
  Printer,
  ClipboardList,
  Upload,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Layers,
  ShieldCheck,
  Zap,
  Filter,
  Sparkles,
  Database,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  ChevronRight,
  Sliders,
  HelpCircle
} from 'lucide-react';
import Papa from 'papaparse';
import { cn, sanitizeCsvData } from '../lib/utils';
import { enforceEditOrDeletePermission, getCurrentUserContext } from '../lib/permissions';
import LegacyLayout, { LegacyButton } from '../components/LegacyLayout';
import { supabase } from '../lib/supabase';
import { refreshSattaCache } from '../services/sattaRateService';
import { logChange } from '../services/auditLogService';
import { UniversalAuditLogModal } from '../components/UniversalAuditLogModal';

// Complete grades list in order from the official Satta chart specification
const ALL_GRADES = [
  'TD3', 'TD4', 'TD5', 'TD6', 'TD7', 'TD8', 'TD9', 'TD10',
  'BTR HD KS', 'BTR HD CS', 'BTR HD BS', 'BTR NB KS', 'BTR NB FFS', 'BTR NB (SMR)',
  'W5', 'W6', 'LOOSE', 'P.BALES', 'H.BALES', 'HBJB', 'ROPES', 'CUTTING',
  'TH.WASTE', 'RRY CUTT', 'M.S.MID', 'M.MID', 'M.BOT', 'M.B.BOT', 'M.X.BOT',
  'BOT', 'B.BOT', 'X.BOT', 'DRUMS'
];

export const MONTH_COLS = [
  { name: 'APR', month: '04', days: 30, yearOffset: 0 },
  { name: 'MAY', month: '05', days: 31, yearOffset: 0 },
  { name: 'JUN', month: '06', days: 30, yearOffset: 0 },
  { name: 'JUL', month: '07', days: 31, yearOffset: 0 },
  { name: 'AUG', month: '08', days: 31, yearOffset: 0 },
  { name: 'SEP', month: '09', days: 30, yearOffset: 0 },
  { name: 'OCT', month: '10', days: 31, yearOffset: 0 },
  { name: 'NOV', month: '11', days: 30, yearOffset: 0 },
  { name: 'DEC', month: '12', days: 31, yearOffset: 0 },
  { name: 'JAN', month: '01', days: 31, yearOffset: 1 },
  { name: 'FEB', month: '02', days: 28, yearOffset: 1 },
  { name: 'MAR', month: '03', days: 31, yearOffset: 1 }
];

interface AreaDifferential {
  area: string;
  diffs: Record<string, number>;
}

// Area Differential interface (populated strictly from Supabase satta_differentials table)

const formatDateDMY = (dateStr: string | null) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const formatDateTime = (isoStr?: string | null) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day}-${month}-${year} ${timeStr}`;
};

export default function SattaChart({ 
  onClose, 
  isEmbedded = false,
  onNavigate
}: { 
  onClose?: () => void; 
  isEmbedded?: boolean; 
  onNavigate?: (page: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'base_rate' | 'matrix' | 'diff_history'>('base_rate');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [showUploadSuccessModal, setShowUploadSuccessModal] = useState<boolean>(false);
  
  // Rate Inputs
  const [baseRate, setBaseRate] = useState<number>(17500);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('Standard Base Rate update');
  
  // Database States
  const [dbDifferentials, setDbDifferentials] = useState<Record<string, Record<string, number>>>({});
  const [dbDiffUsers, setDbDiffUsers] = useState<Record<string, Record<string, { user: string; time?: string }>>>({});
  const [rateHistory, setRateHistory] = useState<any[]>([]);
  const [latestRateRecord, setLatestRateRecord] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{message: string, success: boolean} | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  const [showUniversalAuditModal, setShowUniversalAuditModal] = useState<boolean>(false);

  // Differential History Audit State
  const [diffHistoryLogs, setDiffHistoryLogs] = useState<any[]>([]);
  const [isDiffHistoryLoading, setIsDiffHistoryLoading] = useState<boolean>(false);
  const [diffFilterDateFrom, setDiffFilterDateFrom] = useState<string>('');
  const [diffFilterDateTo, setDiffFilterDateTo] = useState<string>('');
  const [diffFilterArea, setDiffFilterArea] = useState<string>('ALL');
  const [diffFilterGrade, setDiffFilterGrade] = useState<string>('ALL');
  const [diffFilterChangedBy, setDiffFilterChangedBy] = useState<string>('ALL');
  const [diffFilterSearch, setDiffFilterSearch] = useState<string>('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');

  // Cell Editing
  const [editingCell, setEditingCell] = useState<{area: string, grade: string, val: string} | null>(null);
  
  // Hover Tooltip state
  const [hoveredCell, setHoveredCell] = useState<{area: string, grade: string, diff: number, rate: number} | null>(null);

  // Historical Inspection Modal
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<any | null>(null);
  const [historyRunDetails, setHistoryRunDetails] = useState<any[]>([]);
  const [isHistDetailLoading, setIsHistDetailLoading] = useState<boolean>(false);

  // New Audit, Confirmation and Duplicate Check state variables
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState<boolean>(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{hasDuplicate: boolean, count: number}>({ hasDuplicate: false, count: 0 });

  // History Tab Sub-view state
  const [historySubTab, setHistorySubTab] = useState<'range_list' | 'matrix' | 'chronology'>('range_list');

  // CSV Import State
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Initialize and Seed Table if needed
  useEffect(() => {
    loadChartConfig();
    fetchRateHistory();
    fetchDiffHistory();
  }, []);

  useLiveAutoRefresh(() => {
    loadChartConfig();
    fetchRateHistory();
    fetchDiffHistory();
  }, [], { tables: ['satta_base_rates', 'satta_differentials', 'satta_calculated_rates', 'satta_differential_audit_logs', 'app_audit_logs'] });

  // Auto-select latest instance when entering range_list mode
  useEffect(() => {
    if ((historySubTab === 'range_list' || historySubTab === 'matrix') && rateHistory.length > 0 && !selectedHistoryRun) {
      handleViewHistoryDetails(rateHistory[0]);
    }
  }, [historySubTab, rateHistory]);

  // Fast rate lookup map by date key (YYYY-MM-DD)
  // Preserves latest update on that date as the active rate
  const rateLookup = useMemo(() => {
    const map = new Map<string, number>();
    rateHistory.forEach(r => {
      if (r.start_date && r.base_rate !== undefined && r.base_rate !== null) {
        if (!map.has(r.start_date)) {
          map.set(r.start_date, Number(r.base_rate));
        }
      }
    });
    return map;
  }, [rateHistory]);

  // Intraday multiple updates tracker per date
  const intradayUpdatesMap = useMemo(() => {
    const map = new Map<string, any[]>();
    rateHistory.forEach(r => {
      if (r.start_date && r.base_rate !== undefined && r.base_rate !== null) {
        const list = map.get(r.start_date) || [];
        list.push(r);
        map.set(r.start_date, list);
      }
    });
    return map;
  }, [rateHistory]);

  // Monthly Base Rate Summary Statistics (AVG, MAX, MIN across months)
  const monthlySummaryStats = useMemo(() => {
    return MONTH_COLS.map((m) => {
      const targetYear = selectedYear + (m.yearOffset || 0);
      const rates: number[] = [];
      for (let day = 1; day <= m.days; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${targetYear}-${m.month}-${dayStr}`;
        const rateVal = rateLookup.get(dateKey);
        if (rateVal && rateVal > 0) {
          rates.push(rateVal);
        }
      }
      if (rates.length === 0) {
        return {
          month: m.name,
          avg: null,
          max: null,
          min: null,
          count: 0
        };
      }
      const sum = rates.reduce((a, b) => a + b, 0);
      const avg = sum / rates.length;
      const max = Math.max(...rates);
      const min = Math.min(...rates);
      return {
        month: m.name,
        avg: avg.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2),
        count: rates.length
      };
    });
  }, [selectedYear, rateLookup]);

  const ensureSattaTablesExist = async () => {
    if (!supabase) return;
    const queries = [
      `CREATE TABLE IF NOT EXISTS satta_base_rates (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         base_rate NUMERIC(15,2) NOT NULL DEFAULT 17500,
         start_date DATE NOT NULL DEFAULT CURRENT_DATE,
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_base_rates DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_differentials (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         area TEXT NOT NULL,
         grade TEXT NOT NULL,
         differential NUMERIC(15,2) NOT NULL DEFAULT 0,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
         UNIQUE(area, grade)
       );`,
      `ALTER TABLE IF EXISTS satta_differentials DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_calculated_rates (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         base_rate_id UUID,
         base_rate NUMERIC(15,2) NOT NULL,
         start_date DATE NOT NULL,
         area TEXT NOT NULL,
         grade TEXT NOT NULL,
         differential NUMERIC(15,2) NOT NULL,
         final_rate NUMERIC(15,2) NOT NULL,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_calculated_rates DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_base_rate_audit_logs (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         old_rate NUMERIC(15,2),
         new_rate NUMERIC(15,2) NOT NULL,
         changed_date DATE NOT NULL,
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_base_rate_audit_logs DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_differential_audit_logs (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         changed_date DATE NOT NULL DEFAULT CURRENT_DATE,
         area TEXT NOT NULL,
         grade TEXT NOT NULL,
         old_differential NUMERIC(15,2),
         new_differential NUMERIC(15,2) NOT NULL,
         differential_change NUMERIC(15,2),
         changed_by TEXT DEFAULT 'ADMIN',
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_differential_audit_logs DISABLE ROW LEVEL SECURITY;`
    ];

    for (const sql of queries) {
      try {
        await supabase.rpc('exec_sql', { query: sql });
      } catch (err) {
        console.warn('Inline schema query warning:', err);
      }
    }
    
    try {
      await supabase.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema';" });
    } catch (_) {}
  };

  const loadChartConfig = async (isRetry = false) => {
    setIsLoading(true);
    try {
      if (!supabase) return;
      
      // Fetch latest base rate
      const { data: baseRates, error: brErr } = await supabase
        .from('satta_base_rates')
        .select('*')
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (brErr && !isRetry) {
        console.log("Database fetch failed. Attempting self-healing table setup...", brErr.message);
        await ensureSattaTablesExist();
        setIsLoading(false);
        return loadChartConfig(true);
      } else if (brErr) {
        throw brErr;
      }

      if (baseRates && baseRates.length > 0) {
        setLatestRateRecord(baseRates[0]);
        setBaseRate(Number(baseRates[0].base_rate));
        setStartDate(baseRates[0].start_date);
        setRemarks(baseRates[0].remarks || '');
      }

      // Fetch differentials
      const { data: diffs, error: diffErr } = await supabase
        .from('satta_differentials')
        .select('*');

      if (diffs && diffs.length > 0) {
        // Map to structured cache and auto-sanitize extreme typos if any (> 5000)
        const cache: Record<string, Record<string, number>> = {};
        const userMap: Record<string, Record<string, { user: string; time?: string }>> = {};
        diffs.forEach(item => {
          let area = String(item.area || '').trim().toUpperCase();
          // LOWER ASSAM & BILASIPARA & L/A TARABARI are the exact same: treat all as L/A TARABARI
          if (
            area === 'LOWER ASSAM' || 
            area === 'BILASIPARA' || 
            area.includes('TARABARI') || 
            area === 'L/A' ||
            area === 'BELLOW ASSAM' || 
            area === 'BELOW ASSAM' ||
            area.includes('BELLOW') ||
            area.includes('BELOW')
          ) {
            area = 'L/A TARABARI';
          }
          if (!cache[area]) cache[area] = {};
          if (!userMap[area]) userMap[area] = {};
          let val = Number(item.differential);
          if (Math.abs(val) > 5000) {
            val = Math.round(val / 10);
            if (supabase) {
              supabase.from('satta_differentials').update({ differential: val }).eq('id', item.id).then();
            }
          }
          cache[area][item.grade] = val;
          userMap[area][item.grade] = {
            user: item.updated_by || 'ADMIN',
            time: item.updated_at || item.created_at
          };
        });

        // Clean up any stale LOWER ASSAM, BILASIPARA, or BELLOW ASSAM rows from database
        if (supabase) {
          supabase.from('satta_differentials').delete().in('area', ['LOWER ASSAM', 'BILASIPARA', 'BELLOW ASSAM', 'BELOW ASSAM']).then();
          supabase.from('satta_calculated_rates').delete().in('area', ['LOWER ASSAM', 'BILASIPARA', 'BELLOW ASSAM', 'BELOW ASSAM']).then();
        }

        setDbDifferentials(cache);
        setDbDiffUsers(userMap);
      } else {
        setDbDifferentials({});
        setDbDiffUsers({});
      }
      setLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error("Error loading chart variables:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const silentSeedHistoricalList = async (activeDiffs?: Record<string, Record<string, number>>) => {
    // Satta rates must originate strictly from user input and Supabase tables, not hardcoded seed lists
    if (!supabase) return;
    try {
      const diffsToUse = activeDiffs || dbDifferentials || {};
      const { data: baseRates } = await supabase
        .from('satta_base_rates')
        .select('*')
        .order('start_date', { ascending: false });

      if (baseRates && baseRates.length > 0) {
        for (const item of baseRates) {
          const calcRows: any[] = [];
          Object.keys(diffsToUse).forEach(area => {
            const gradesCache = diffsToUse[area] || {};
            Object.keys(gradesCache).forEach(grade => {
              const diffVal = gradesCache[grade] || 0;
              calcRows.push({
                base_rate_id: item.id,
                base_rate: Number(item.base_rate),
                start_date: item.start_date,
                area: area,
                grade: grade,
                differential: diffVal,
                final_rate: Number(item.base_rate) + diffVal
              });
            });
          });
          if (calcRows.length > 0) {
            await supabase.from('satta_calculated_rates').delete().eq('start_date', item.start_date);
            await supabase.from('satta_calculated_rates').insert(calcRows);
          }
        }
      }
    } catch (e) {
      console.warn("Calculated rate synchronization warning:", e);
    }
  };

  const fetchRateHistory = async (isRetry = false) => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('satta_base_rates')
        .select('*')
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error && !isRetry) {
        console.log("History fetch failed. Self-repair routing...");
        await ensureSattaTablesExist();
        return fetchRateHistory(true);
      } else if (error) {
        throw error;
      }

      setRateHistory(data || []);
      if (data && data.length > 0 && !selectedHistoryRun) {
        handleViewHistoryDetails(data[0]);
      }
    } catch (err) {
      console.error("Error fetching rate logs:", err);
    }
  };

  // Cell Editing Save Action
  const handleSaveCellDifferential = async () => {
    if (!editingCell || !supabase) return;
    const { area, grade, val } = editingCell;
    const numericDiff = Number(val) || 0;
    let canonicalArea = area;
    const upper = area.trim().toUpperCase();
    if (
      upper === 'LOWER ASSAM' ||
      upper === 'BILASIPARA' ||
      upper === 'L/A' ||
      upper.includes('TARABARI') ||
      upper === 'BELLOW ASSAM' ||
      upper === 'BELOW ASSAM' ||
      upper.includes('BELLOW') ||
      upper.includes('BELOW')
    ) {
      canonicalArea = 'L/A TARABARI';
    }

    const oldDiff = dbDifferentials[canonicalArea]?.[grade] !== undefined
      ? Number(dbDifferentials[canonicalArea][grade])
      : null;
    const diffChange = oldDiff !== null ? numericDiff - oldDiff : null;
    const changedDate = new Date().toISOString().split('T')[0];
    const userCtx = getCurrentUserContext();
    const changedBy = userCtx?.username || userCtx?.userName || userCtx?.userId || 'ADMIN';
    const nowIso = new Date().toISOString();

    try {
      setIsLoading(true);
      // 1. Upsert into live satta_differentials table with updated_by and timestamp
      const { error } = await supabase
        .from('satta_differentials')
        .upsert({
          area: canonicalArea,
          grade,
          differential: numericDiff,
          updated_by: changedBy,
          updated_at: nowIso,
          start_date: changedDate
        }, {
          onConflict: 'area,grade'
        })
        .select();

      if (error) throw error;

      // 2. Auto-save per-day differential calculated rate snapshot in database
      await supabase
        .from('satta_calculated_rates')
        .upsert({
          start_date: changedDate,
          area: canonicalArea,
          grade,
          differential: numericDiff,
          base_rate: baseRate,
          final_rate: baseRate + numericDiff,
          updated_by: changedBy,
          created_at: nowIso
        })
        .then();

      // 3. Record audit history in Supabase satta_differential_audit_logs
      await supabase
        .from('satta_differential_audit_logs')
        .insert({
          changed_date: changedDate,
          area: canonicalArea,
          grade,
          old_differential: oldDiff,
          new_differential: numericDiff,
          differential_change: diffChange,
          changed_by: changedBy,
          remarks: `Live Pivot Matrix edit: ${oldDiff !== null ? (oldDiff >= 0 ? '+' : '') + oldDiff : 'New'} → ${(numericDiff >= 0 ? '+' : '') + numericDiff}`,
          created_at: nowIso
        });

      // 4. Record in Universal App Audit Log
      await logChange({
        module: 'Satta Desk / Rate Chart',
        entity_name: 'Satta Differential',
        record_id: `${canonicalArea} • ${grade}`,
        action: 'UPDATE',
        field_name: 'differential',
        field_label: `${canonicalArea} [${grade}] Differential`,
        old_value: oldDiff !== null ? (oldDiff >= 0 ? `+${oldDiff}` : `${oldDiff}`) : '0',
        new_value: numericDiff >= 0 ? `+${numericDiff}` : `${numericDiff}`,
        user_name: changedBy,
        remarks: `Live Pivot Matrix differential updated from ${oldDiff !== null ? oldDiff : 0} to ${numericDiff} on ${changedDate}`
      });

      // Clean up any stale LOWER ASSAM, BILASIPARA, or BELLOW ASSAM rows
      if (canonicalArea === 'L/A TARABARI') {
        supabase.from('satta_differentials').delete().in('area', ['LOWER ASSAM', 'BILASIPARA', 'BELLOW ASSAM', 'BELOW ASSAM']).then();
        supabase.from('satta_calculated_rates').delete().in('area', ['LOWER ASSAM', 'BILASIPARA', 'BELLOW ASSAM', 'BELOW ASSAM']).then();
      }

      setDbDifferentials(prev => ({
        ...prev,
        [canonicalArea]: {
          ...(prev[canonicalArea] || {}),
          [grade]: numericDiff
        }
      }));

      setDbDiffUsers(prev => ({
        ...prev,
        [canonicalArea]: {
          ...(prev[canonicalArea] || {}),
          [grade]: { user: changedBy, time: nowIso }
        }
      }));

      // Refresh differential history table & central rate cache
      fetchDiffHistory();
      refreshSattaCache().catch(() => {});

      setEditingCell(null);
      setSaveStatus({
        message: `Differential for ${canonicalArea} [${grade}] updated to ${numericDiff >= 0 ? '+' : ''}${numericDiff}. Change recorded in Differential History!`,
        success: true
      });
    } catch (exc: any) {
      alert("Error saving differential: " + exc.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Differential History from Supabase
  const fetchDiffHistory = async () => {
    if (!supabase) return;
    setIsDiffHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('satta_differential_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching satta_differential_audit_logs from Supabase:', error);
      } else {
        setDiffHistoryLogs(data || []);
      }
    } catch (err) {
      console.error('Failed to load differential history:', err);
    } finally {
      setIsDiffHistoryLoading(false);
    }
  };

  const checkForDuplicateRates = async (selectedDate: string) => {
    if (!supabase) return { hasDuplicate: false, count: 0 };
    try {
      const { data, error } = await supabase
        .from('satta_calculated_rates')
        .select('id')
        .eq('start_date', selectedDate);
      
      if (error) {
        return { hasDuplicate: false, count: 0 };
      }
      return {
        hasDuplicate: data && data.length > 0,
        count: data ? data.length : 0
      };
    } catch (e) {
      return { hasDuplicate: false, count: 0 };
    }
  };

  const handleUpdateBaseRate = async () => {
    if (!baseRate || baseRate <= 0) {
      alert("Please provide a valid Base Rate greater than 0.");
      return;
    }

    setIsCheckingDuplicates(true);
    const result = await checkForDuplicateRates(startDate);
    setDuplicateCheckResult(result);
    setIsCheckingDuplicates(false);
    setShowConfirmModal(true);
  };

  const executeRateUpdate = async () => {
    setShowConfirmModal(false);
    if (!supabase) {
      alert("Database offline. Satta Chart history cannot be recorded.");
      return;
    }

    setIsLoading(true);
    setSaveStatus(null);

    const userCtx = getCurrentUserContext();
    const currentUserName = userCtx?.username || userCtx?.userName || userCtx?.userId || 'ADMIN';
    const nowIso = new Date().toISOString();

    try {
      // Do NOT delete previous base rate records on the same date!
      // Multiple intraday updates are preserved in satta_base_rates and history.
      const oldRateValue = latestRateRecord ? Number(latestRateRecord.base_rate) : null;

      let rRecord: any = null;
      const basePayload: any = {
        base_rate: baseRate,
        start_date: startDate,
        updated_by: currentUserName,
        remarks: remarks || `Base rate changed to ₹${baseRate.toLocaleString('en-IN')}`,
        created_at: nowIso
      };

      const { data: d1, error: e1 } = await supabase
        .from('satta_base_rates')
        .insert(basePayload)
        .select()
        .single();

      if (e1) {
        if (e1.message?.includes('updated_by') || String(e1.message).includes('schema cache')) {
          delete basePayload.updated_by;
          const { data: d2, error: e2 } = await supabase
            .from('satta_base_rates')
            .insert(basePayload)
            .select()
            .single();
          if (e2) throw e2;
          rRecord = d2;
        } else {
          throw e1;
        }
      } else {
        rRecord = d1;
      }

      await supabase
        .from('satta_base_rate_audit_logs')
        .insert({
          old_rate: oldRateValue,
          new_rate: baseRate,
          changed_date: startDate,
          changed_by: currentUserName,
          remarks: remarks || `Base rate changed from ₹${oldRateValue?.toLocaleString('en-IN') || '0'} to ₹${baseRate.toLocaleString('en-IN')} by ${currentUserName}`,
          created_at: nowIso
        });

      // Log into Universal System Audit Log
      await logChange({
        module: 'Satta Desk / Rate Chart',
        entity_name: 'Satta Base Rate',
        record_id: startDate,
        action: 'UPDATE',
        field_name: 'base_rate',
        field_label: 'Satta Base Rate (₹/Qtl)',
        old_value: oldRateValue !== null ? `₹${oldRateValue.toLocaleString('en-IN')}` : 'None',
        new_value: `₹${baseRate.toLocaleString('en-IN')}`,
        user_name: currentUserName,
        remarks: remarks || `Base rate updated to ₹${baseRate.toLocaleString('en-IN')}`
      });

      const calcRows: any[] = [];
      
      Object.keys(dbDifferentials).forEach(area => {
        const gradesCache = dbDifferentials[area] || {};
        Object.keys(gradesCache).forEach(grade => {
          const diffVal = gradesCache[grade] || 0;
          calcRows.push({
            base_rate_id: rRecord.id,
            base_rate: baseRate,
            start_date: startDate,
            area: area,
            grade: grade,
            differential: diffVal,
            final_rate: baseRate + diffVal,
            updated_by: currentUserName,
            created_at: nowIso
          });
        });
      });

      if (calcRows.length > 0) {
        // Refresh calculated rates snapshot for this date
        await supabase
          .from('satta_calculated_rates')
          .delete()
          .eq('start_date', startDate);

        const { error: batchErr } = await supabase
          .from('satta_calculated_rates')
          .insert(calcRows);

        if (batchErr) throw batchErr;
      }

      setSaveStatus({
        message: `Base Rate ₹${baseRate.toLocaleString()} published successfully by ${currentUserName}. ${calcRows.length} area-grade items calculated for ${startDate}!`,
        success: true
      });

      loadChartConfig();
      fetchRateHistory();
    } catch (err: any) {
      setSaveStatus({
        message: "Failed to record Satta Base Rate: " + err.message,
        success: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewHistoryDetails = async (run: any) => {
    setSelectedHistoryRun(run);
    setIsHistDetailLoading(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('satta_calculated_rates')
        .select('*')
        .eq('base_rate_id', run.id);

      if (error) throw error;
      setHistoryRunDetails(data || []);
    } catch (err) {
      console.error("Error retrieving historical table run:", err);
    } finally {
      setIsHistDetailLoading(false);
    }
  };

  const handleSeedHistoricalList = async () => {
    if (!supabase) return;
    if (!window.confirm("Seed the historical base rate range logs? Existing records on these identical dates will be replaced.")) return;
    
    setIsLoading(true);
    try {
      await ensureSattaTablesExist();
      await silentSeedHistoricalList();
      alert("Historic Base Rate range series successfully written to database!");
      loadChartConfig();
      fetchRateHistory();
    } catch (err: any) {
      alert("Failed to seed Satta range logs: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCsvExport = (rows: any[], filename: string) => {
    const dataToExport = rows.map((r, i) => ({
      Srl: i + 1,
      Area: r.area,
      Grade: r.grade,
      "Base Rate": r.base_rate,
      "Differential (Premium/Discount)": r.differential,
      "Calculated Final Rate": r.final_rate,
      "Effective From Date": r.start_date,
    }));
    const sanitizedData = sanitizeCsvData(dataToExport);
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleCsv = () => {
    const headers = ['Area', 'Grade', 'Differential'];
    const rows: any[] = [];
    Object.entries(dbDifferentials).forEach(([areaName, diffs]) => {
      Object.entries(diffs).forEach(([grade, diffVal]) => {
        rows.push([areaName, grade, diffVal]);
      });
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'satta_chart_latest.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (file: File) => {
    setIsUploading(true);
    setUploadProgress(20);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: async (results) => {
        setUploadProgress(40);
        const data = results.data as any[];
        if (!data || data.length === 0) {
          alert("Uploaded CSV is empty.");
          setIsUploading(false);
          return;
        }

        const firstRow = data[0] || {};
        const rawKeys = Object.keys(firstRow);

        // Find Area column
        const areaCol = rawKeys.find(k => /^(area|region|district|place)$/i.test(k.trim())) ||
                        rawKeys.find(k => /area/i.test(k));

        // Find Grade column
        const gradeCol = rawKeys.find(k => /^(grade|item|jute_grade|jute grade)$/i.test(k.trim())) ||
                         rawKeys.find(k => /grade/i.test(k));

        // Find Differential column
        const diffCol = rawKeys.find(k => /^(differential|diff|difference|differential \(premium\/discount\)|premium\/discount|rate diff)$/i.test(k.trim())) ||
                        rawKeys.find(k => /diff/i.test(k)) ||
                        rawKeys.find(k => /^rate$/i.test(k.trim()));

        // Map to guarantee strictly ONE row per unique (Area, Grade)
        // This is CRITICAL to prevent PostgreSQL:
        // "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const uniqueMap = new Map<string, { area: string; grade: string; differential: number }>();

        // Normalizer to treat LOWER ASSAM, BILASIPARA, and L/A TARABARI as identical
        const normalizeUploadedArea = (raw: string): string => {
          const upper = String(raw || '').trim().toUpperCase();
          if (
            upper === 'LOWER ASSAM' || 
            upper === 'BILASIPARA' || 
            upper === 'L/A' || 
            upper.includes('TARABARI') ||
            upper === 'BELLOW ASSAM' ||
            upper === 'BELOW ASSAM' ||
            upper.includes('BELLOW') ||
            upper.includes('BELOW')
          ) {
            return 'L/A TARABARI';
          }
          return upper;
        };

        if (areaCol && gradeCol && diffCol) {
          // 1. Standard 3-column format: Area, Grade, Differential
          data.forEach((row: any) => {
            const rawArea = normalizeUploadedArea(row[areaCol]);
            const rawGrade = String(row[gradeCol] || '').trim().toUpperCase();
            const rawDiffVal = row[diffCol];

            if (rawArea && rawGrade && rawDiffVal !== undefined && rawDiffVal !== null && String(rawDiffVal).trim() !== '') {
              const cleanedDiff = Number(String(rawDiffVal).replace(/[^0-9.-]/g, '')) || 0;
              const compositeKey = `${rawArea}___${rawGrade}`;
              uniqueMap.set(compositeKey, {
                area: rawArea,
                grade: rawGrade,
                differential: cleanedDiff
              });
            }
          });
        } else if (areaCol) {
          // 2. Matrix / Pivot format: Column 1 is Area, other columns are Grade names (e.g. TD4, TD5, TD6, etc.)
          const otherCols = rawKeys.filter(k => k !== areaCol && !/^(srl|sl|id|created_at|start_date)$/i.test(k.trim()));
          data.forEach((row: any) => {
            const rawArea = normalizeUploadedArea(row[areaCol]);
            if (!rawArea) return;

            otherCols.forEach(col => {
              const rawDiffVal = row[col];
              if (rawDiffVal !== undefined && rawDiffVal !== null && String(rawDiffVal).trim() !== '') {
                const cleanedGrade = col.trim().toUpperCase();
                const cleanedDiff = Number(String(rawDiffVal).replace(/[^0-9.-]/g, '')) || 0;
                const compositeKey = `${rawArea}___${cleanedGrade}`;
                uniqueMap.set(compositeKey, {
                  area: rawArea,
                  grade: cleanedGrade,
                  differential: cleanedDiff
                });
              }
            });
          });
        } else {
          alert("Invalid CSV format. Please ensure the CSV contains 'Area', 'Grade', and 'Differential' columns (or an 'Area' column with Grade columns).");
          setIsUploading(false);
          return;
        }

        const upsertRows = Array.from(uniqueMap.values());

        if (upsertRows.length === 0) {
          alert("No valid Area-Grade differential rows found in the uploaded CSV.");
          setIsUploading(false);
          return;
        }

        setIsLoading(true);
        setUploadProgress(60);

        try {
          const changedDate = new Date().toISOString().split('T')[0];
          const userCtx = getCurrentUserContext();
          const changedBy = userCtx?.username || userCtx?.userName || 'ADMIN';
          const nowIso = new Date().toISOString();

          // Prepare audit log entries for any differential that changed or was newly set
          const auditLogRows: any[] = [];
          upsertRows.forEach(item => {
            const oldVal = dbDifferentials[item.area]?.[item.grade] !== undefined
              ? Number(dbDifferentials[item.area][item.grade])
              : null;
            const newVal = Number(item.differential);

            if (oldVal === null || oldVal !== newVal) {
              const diffChange = oldVal !== null ? newVal - oldVal : null;
              auditLogRows.push({
                changed_date: changedDate,
                area: item.area,
                grade: item.grade,
                old_differential: oldVal,
                new_differential: newVal,
                differential_change: diffChange,
                changed_by: `${changedBy} (CSV)`,
                remarks: `CSV Upload: ${oldVal !== null ? (oldVal >= 0 ? '+' : '') + oldVal : 'New'} → ${(newVal >= 0 ? '+' : '') + newVal}`,
                created_at: nowIso
              });
            }
          });

          if (supabase) {
            // Upsert in safe batches of 100 rows to ensure fast, failure-proof execution
            const batchSize = 100;
            for (let i = 0; i < upsertRows.length; i += batchSize) {
              const batch = upsertRows.slice(i, i + batchSize);
              const { error: batchErr } = await supabase
                .from('satta_differentials')
                .upsert(batch, { onConflict: 'area,grade' });

              if (batchErr) {
                console.warn("Batch upsert encountered issue, retrying individually:", batchErr.message);
                // Fallback: row-by-row upsert so no single row blocks the rest
                for (const item of batch) {
                  await supabase
                    .from('satta_differentials')
                    .upsert([item], { onConflict: 'area,grade' });
                }
              }
              const currentProgress = 60 + Math.round(((i + batch.length) / upsertRows.length) * 20);
              setUploadProgress(Math.min(currentProgress, 80));
            }

            // Record audit logs in satta_differential_audit_logs so they show in Differential History
            if (auditLogRows.length > 0) {
              for (let i = 0; i < auditLogRows.length; i += batchSize) {
                const auditBatch = auditLogRows.slice(i, i + batchSize);
                await supabase
                  .from('satta_differential_audit_logs')
                  .insert(auditBatch);
              }
            }
          }

          setDbDifferentials(prev => {
            const copy = { ...prev };
            upsertRows.forEach(item => {
              if (!copy[item.area]) copy[item.area] = {};
              copy[item.area][item.grade] = item.differential;
            });
            return copy;
          });

          // Refresh differential history table & central rate cache
          fetchDiffHistory();
          refreshSattaCache().catch(() => {});

          setUploadProgress(100);
          setSaveStatus({
            message: `Satta Chart CSV uploaded successfully! Saved ${upsertRows.length} area-grade differentials (${auditLogRows.length} logged in Differential History).`,
            success: true
          });

          // Mark Satta Chart as uploaded in system storage
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem('satta_chart_uploaded', 'true');
              window.localStorage.setItem('satta_chart_upload_date', new Date().toISOString().split('T')[0]);
            }
            window.dispatchEvent(new CustomEvent('satta-chart-uploaded'));
            window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'satta_differentials' } }));
          } catch {}

          setShowUploadSuccessModal(true);
          loadChartConfig();
        } catch (err: any) {
          alert("Error saving uploaded differentials: " + err.message);
        } finally {
          setIsLoading(false);
          setTimeout(() => setIsUploading(false), 500);
        }
      },
      error: (error) => {
        alert("Error parsing CSV file: " + error.message);
        setIsUploading(false);
      }
    });
  };

  // Executive Dynamic Metrics Calculation
  const metrics = useMemo(() => {
    let maxRate = 0;
    let maxArea = '';
    let maxGrade = '';
    let minRate = Infinity;
    let minArea = '';
    let minGrade = '';
    let totalRateSum = 0;
    let cellCount = 0;
    let highPremiumCount = 0;
    let moderatePremiumCount = 0;
    let discountCount = 0;
    let criticalDiscountCount = 0;
    let baseCount = 0;

    const areaSet = new Set<string>();

    Object.entries(dbDifferentials).forEach(([areaName, diffs]) => {
      areaSet.add(areaName);
      ALL_GRADES.forEach(grade => {
        const diffVal = diffs[grade];
        if (diffVal !== undefined) {
          const finalVal = baseRate + diffVal;
          cellCount++;
          totalRateSum += finalVal;
          if (finalVal > maxRate) {
            maxRate = finalVal;
            maxArea = areaName;
            maxGrade = grade;
          }
          if (finalVal < minRate) {
            minRate = finalVal;
            minArea = areaName;
            minGrade = grade;
          }
          if (diffVal >= 1000) highPremiumCount++;
          else if (diffVal > 0) moderatePremiumCount++;
          else if (diffVal === 0) baseCount++;
          else if (diffVal >= -1000) discountCount++;
          else criticalDiscountCount++;
        }
      });
    });

    const avgRate = cellCount > 0 ? Math.round(totalRateSum / cellCount) : baseRate;
    if (minRate === Infinity) minRate = baseRate;

    // Base rate shift
    const prevRate = rateHistory.length > 1 ? Number(rateHistory[1].base_rate) : baseRate;
    const rateDiff = baseRate - prevRate;
    const ratePctChange = prevRate > 0 ? ((rateDiff / prevRate) * 100).toFixed(1) : '0.0';

    return {
      maxRate,
      maxArea,
      maxGrade,
      minRate,
      minArea,
      minGrade,
      avgRate,
      totalAreas: areaSet.size,
      cellCount,
      highPremiumCount,
      moderatePremiumCount,
      premiumCount: highPremiumCount + moderatePremiumCount,
      discountCount,
      criticalDiscountCount,
      baseCount,
      prevRate,
      rateDiff,
      ratePctChange
    };
  }, [dbDifferentials, baseRate, rateHistory]);

  // Combined and Search-Filtered Table Rows derived strictly from Supabase dbDifferentials
  const allAreaRows = useMemo(() => {
    const areaMap = new Map<string, Record<string, number>>();
    // Overlay dynamic differentials and additional regions from database
    Object.entries(dbDifferentials).forEach(([rawAreaName, diffs]) => {
      const upper = String(rawAreaName || '').trim().toUpperCase();
      // LOWER ASSAM & BILASIPARA & L/A TARABARI are the exact same: treat all as L/A TARABARI
      const canonicalArea = (
        upper === 'LOWER ASSAM' || 
        upper === 'BILASIPARA' || 
        upper === 'L/A' || 
        upper.includes('TARABARI') ||
        upper === 'BELLOW ASSAM' ||
        upper === 'BELOW ASSAM' ||
        upper.includes('BELLOW') ||
        upper.includes('BELOW')
      )
        ? 'L/A TARABARI'
        : rawAreaName;

      if (areaMap.has(canonicalArea)) {
        areaMap.set(canonicalArea, { ...areaMap.get(canonicalArea), ...diffs });
      } else {
        areaMap.set(canonicalArea, { ...diffs });
      }
    });

    return Array.from(areaMap.entries()).map(([area, diffs]) => ({
      area,
      diffs
    }));
  }, [dbDifferentials]);

  const filteredSeedRows = useMemo(() => {
    return allAreaRows.filter(row => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const areaLower = row.area.toLowerCase();
        if (areaLower.includes(q)) return true;
        // Search synonyms for Lower Assam (matches L/A TARABARI if user queries LOWER ASSAM, BILASIPARA, or BELLOW ASSAM)
        if ((areaLower.includes('tarabari') || areaLower.includes('lower assam')) && 
            (q.includes('lower') || q.includes('assam') || q.includes('bilasipara') || q.includes('tarabari') || q === 'l/a' || q.includes('bellow') || q.includes('below'))) {
          return true;
        }
        return false;
      }
      return true;
    });
  }, [allAreaRows, searchTerm]);

  const visibleGrades = useMemo(() => {
    if (selectedGradeFilter === 'TD') {
      return ALL_GRADES.filter(g => g.startsWith('TD'));
    }
    if (selectedGradeFilter === 'BTR') {
      return ALL_GRADES.filter(g => g.startsWith('BTR'));
    }
    if (selectedGradeFilter === 'MESTA') {
      return ALL_GRADES.filter(g => g.startsWith('M.'));
    }
    return ALL_GRADES;
  }, [selectedGradeFilter]);

  const distinctDiffAreas = useMemo(() => {
    const set = new Set<string>();
    diffHistoryLogs.forEach((l: any) => {
      if (l.area) set.add(String(l.area).trim().toUpperCase());
    });
    Object.keys(dbDifferentials).forEach(a => {
      if (a) set.add(a.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [diffHistoryLogs, dbDifferentials]);

  const distinctDiffGrades = useMemo(() => {
    const set = new Set<string>();
    diffHistoryLogs.forEach((l: any) => {
      if (l.grade) set.add(String(l.grade).trim().toUpperCase());
    });
    ALL_GRADES.forEach(g => set.add(g));
    return Array.from(set);
  }, [diffHistoryLogs]);

  const distinctDiffUsers = useMemo(() => {
    const set = new Set<string>();
    diffHistoryLogs.forEach((l: any) => {
      if (l.changed_by) set.add(String(l.changed_by).trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [diffHistoryLogs]);

  const filteredDiffHistoryLogs = useMemo(() => {
    return diffHistoryLogs.filter((log: any) => {
      // Date from
      if (diffFilterDateFrom && log.changed_date && log.changed_date < diffFilterDateFrom) {
        return false;
      }
      // Date to
      if (diffFilterDateTo && log.changed_date && log.changed_date > diffFilterDateTo) {
        return false;
      }
      // Area filter
      if (diffFilterArea !== 'ALL') {
        const logArea = String(log.area || '').trim().toUpperCase();
        const filterArea = diffFilterArea.trim().toUpperCase();
        if (logArea !== filterArea) return false;
      }
      // Grade filter
      if (diffFilterGrade !== 'ALL') {
        const logGrade = String(log.grade || '').trim().toUpperCase();
        const filterGrade = diffFilterGrade.trim().toUpperCase();
        if (logGrade !== filterGrade) return false;
      }
      // Changed By filter
      if (diffFilterChangedBy !== 'ALL') {
        const logUser = String(log.changed_by || '').trim().toUpperCase();
        const filterUser = diffFilterChangedBy.trim().toUpperCase();
        if (logUser !== filterUser) return false;
      }
      // Search
      if (diffFilterSearch.trim()) {
        const q = diffFilterSearch.trim().toLowerCase();
        const matchArea = String(log.area || '').toLowerCase().includes(q);
        const matchGrade = String(log.grade || '').toLowerCase().includes(q);
        const matchUser = String(log.changed_by || '').toLowerCase().includes(q);
        const matchRemarks = String(log.remarks || '').toLowerCase().includes(q);
        const matchDate = formatDateDMY(log.changed_date).toLowerCase().includes(q);
        if (!matchArea && !matchGrade && !matchUser && !matchRemarks && !matchDate) {
          return false;
        }
      }
      return true;
    });
  }, [
    diffHistoryLogs,
    diffFilterDateFrom,
    diffFilterDateTo,
    diffFilterArea,
    diffFilterGrade,
    diffFilterChangedBy,
    diffFilterSearch
  ]);

  const content = (
    <div className="space-y-6 max-w-full font-sans pb-12 bg-[#FAF8F5] min-h-screen text-[#1A2619]">
      
      {/* TOP NAVIGATION & BREADCRUMB HEADER */}
      <div className="bg-[#174C2C] text-white p-3 md:p-2 rounded-2xl shadow-xl border-2 border-[#103A20] relative overflow-hidden">
        {/* Subtle decorative background glow */}
       {/*  <div className="absolute -right-16 -top-16 w-64 h-44 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" /> */}
          {/* <div className="absolute right-32 bottom-0 w-48 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" /> */}
        
        {/* Navigation Tabs */}
        <div className="flex pt-1 gap-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('base_rate')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm",
              activeTab === 'base_rate'
                ? "bg-[#0F351E] text-white border-2 border-[#D4AF37] shadow-lg scale-105"
                : "bg-[#103A20] text-white hover:bg-[#215E38] font-bold border border-[#235E39]"
            )}
          >
            <DollarSign className={cn("h-4 w-4", activeTab === 'base_rate' ? "text-[#D4AF37]" : "text-emerald-300")} />
            <span className="text-white font-black">Satta Chart Base Rate</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm",
              activeTab === 'matrix'
                ? "bg-[#0F351E] text-white border-2 border-[#D4AF37] shadow-lg scale-105"
                : "bg-[#103A20] text-white hover:bg-[#215E38] font-bold border border-[#235E39]"
            )}
          >
            <FileSpreadsheet className={cn("h-4 w-4", activeTab === 'matrix' ? "text-[#D4AF37]" : "text-emerald-300")} />
            <span className="text-white font-black">Live Pivot Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('diff_history')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm",
              activeTab === 'diff_history'
                ? "bg-[#0F351E] text-white border-2 border-[#D4AF37] shadow-lg scale-105"
                : "bg-[#103A20] text-white hover:bg-[#215E38] font-bold border border-[#235E39]"
            )}
          >
            <History className={cn("h-4 w-4", activeTab === 'diff_history' ? "text-[#D4AF37]" : "text-emerald-300")} />
            <span className="text-white font-black">Differential History</span>
          </button>

          <div className="bg-[#103A20] border border-[#235E39] px-3.5 py-1.5 rounded-xl text-right shrink-0">
            <div className="text-[10px] text-emerald-300 font-black uppercase tracking-wider">Last Updated</div>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3 text-[#D4AF37]" />
              <span className="text-white font-black">Today {lastSyncedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SAVE / STATUS NOTIFICATION BANNER */}
      {saveStatus && (
        <div className={cn(
          "p-4 rounded-2xl border-2 flex items-center justify-between gap-3 text-xs font-bold shadow-md animate-fadeIn",
          saveStatus.success 
            ? "bg-emerald-50 border-emerald-500 text-emerald-950" 
            : "bg-rose-50 border-rose-500 text-rose-950"
        )}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className={cn("h-5 w-5 shrink-0", saveStatus.success ? "text-emerald-600" : "text-rose-600")} />
            <span>{saveStatus.message}</span>
          </div>
          <button onClick={() => setSaveStatus(null)} className="text-slate-500 hover:text-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA BY TAB */}

      {/* TAB 0: SATTA CHART BASE RATE (SIMPLIFIED FULL-YEAR & DAILY MATRIX VIEW) */}
      {activeTab === 'base_rate' && (
        <div className="space-y-4">
          {/* SIMPLIFIED CONTROLS */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#E8E2D5] shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#1E331B] text-[#D4AF37] rounded-2xl shadow-inner">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-black text-[#1E331B] tracking-tight font-serif">
                  Satta Chart Base Rate
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Full-Year Daily Base Rate Matrix dynamically loaded from Supabase database
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-[#FAF8F5] px-3.5 py-2 rounded-xl border border-slate-300">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-sm font-black text-[#1E331B] outline-none cursor-pointer pr-2"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  loadChartConfig();
                  fetchRateHistory();
                }}
                disabled={isLoading}
                className="bg-[#1E331B] hover:bg-[#2A4726] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <RefreshCcw className={`h-4 w-4 text-[#D4AF37] ${isLoading ? 'animate-spin' : ''}`} />
                <span>View Full Year</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintPreview(true)}
                className="bg-[#D4AF37] hover:bg-[#C5A059] text-[#1E331B] font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>Print Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUniversalAuditModal(true)}
                className="bg-[#103A20] hover:bg-[#174C2C] text-[#D4AF37] border border-[#D4AF37]/50 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <History className="h-4 w-4" />
                <span>System Change Log</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                      window.localStorage.setItem('satta_chart_uploaded', 'true');
                      window.localStorage.setItem('satta_chart_upload_date', new Date().toISOString().split('T')[0]);
                    }
                    window.dispatchEvent(new CustomEvent('satta-chart-uploaded'));
                  } catch {}
                  if (onNavigate) {
                    onNavigate('sauda_entry');
                  } else {
                    window.location.hash = '#sauda_entry';
                  }
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <span>Proceed to NEW SAUDA CONTRACT ENTRY</span>
                <ArrowRight className="h-4 w-4 text-amber-300" />
              </button>
            </div>
          </div>

          {/* FULL-YEAR DAILY BASE RATE MATRIX TABLE */}
          <div className="bg-white rounded-2xl border border-[#E8E2D5] shadow-sm overflow-hidden">
            <div className="bg-[#1E331B] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#D4AF37]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#D4AF37]" />
                <span className="text-sm font-black uppercase tracking-wider">
                  Full-Year Daily Base Rate Schedule ({selectedYear})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-emerald-200">
                <span>Database Source: <strong className="text-white font-mono">satta_base_rates</strong></span>
                <span className="text-[#D4AF37]">•</span>
                <span>Active Recorded Days: <strong className="text-white font-mono">{rateHistory.length}</strong></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-slate-300 text-xs font-black text-[#1E331B] uppercase tracking-wider">
                    <th className="py-2.5 px-3 border-r border-slate-300 sticky left-0 bg-[#FAF8F5] z-10 w-16 text-slate-800">
                      Date
                    </th>
                    {MONTH_COLS.map((m) => (
                      <th key={m.name} className="py-2.5 px-3 border-r border-slate-200 min-w-[76px] text-[#1E331B]">
                        {m.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-mono">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    const dayStr = String(day).padStart(2, '0');
                    return (
                      <tr key={day} className="hover:bg-amber-50/60 transition-colors">
                        <td className="py-2 px-3 font-bold text-slate-700 bg-[#FAF8F5] border-r border-slate-300 sticky left-0 z-10">
                          {dayStr}
                        </td>
                        {MONTH_COLS.map((m) => {
                          const targetYear = selectedYear + (m.yearOffset || 0);
                          const dateKey = `${targetYear}-${m.month}-${dayStr}`;
                          const hasDay = day <= m.days;
                          const rateVal = hasDay ? rateLookup.get(dateKey) : null;

                          const dayUpdates = hasDay ? intradayUpdatesMap.get(dateKey) || [] : [];
                          const hasMultiple = dayUpdates.length > 1;
                          const latestUser = dayUpdates[0]?.updated_by;
                          const tooltipText = dayUpdates.map((u, i) => 
                            `#${dayUpdates.length - i}: ₹${Number(u.base_rate).toLocaleString('en-IN')} by ${u.updated_by || 'Admin'} (${u.created_at ? new Date(u.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Logged'})`
                          ).join('\n');

                          return (
                            <td key={m.name} className="py-1.5 px-1 border-r border-slate-100 text-slate-800">
                              {rateVal && rateVal > 0 ? (
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span 
                                    title={tooltipText || `Base Rate: ₹${rateVal.toLocaleString('en-IN')} (Updated by ${latestUser || 'Admin'})`}
                                    className="font-bold text-[#1E331B] bg-emerald-50 text-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200 inline-block min-w-[56px] text-center"
                                  >
                                    {rateVal.toLocaleString('en-IN')}
                                  </span>
                                  {hasMultiple ? (
                                    <span 
                                      title={tooltipText}
                                      className="text-[7.5px] bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-1 rounded cursor-help shadow-2xs"
                                    >
                                      {dayUpdates.length} updates
                                    </span>
                                  ) : latestUser ? (
                                    <span 
                                      className="text-[7.5px] text-slate-500 font-sans truncate max-w-[55px] font-semibold"
                                      title={`Updated by: ${latestUser}`}
                                    >
                                      {latestUser}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-300 font-normal">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MONTHLY SUMMARY TABLE (AVG / MAX / MIN) */}
          <div className="bg-white rounded-2xl border border-[#E8E2D5] shadow-sm overflow-hidden mt-4">
            <div className="bg-[#1E331B] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#D4AF37]">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[#D4AF37]" />
                <span className="text-sm font-black uppercase tracking-wider">
                  Satta Chart Base Rate Monthly Summary ({selectedYear})
                </span>
              </div>
              <div className="text-xs text-emerald-200">
                <span>Calculated Metrics: <strong className="text-white font-mono">AVG • MAX • MIN</strong></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-slate-300 text-xs font-black text-[#1E331B] uppercase tracking-wider">
                    <th className="py-2.5 px-3 border-r border-slate-300 sticky left-0 bg-[#FAF8F5] z-10 w-16 text-slate-800 text-center">
                      
                    </th>
                    {MONTH_COLS.map((m) => (
                      <th key={m.name} className="py-2.5 px-3 border-r border-slate-200 min-w-[76px] text-[#1E331B]">
                        {m.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-mono">
                  {/* AVG Row */}
                  <tr className="hover:bg-amber-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-black text-slate-800 bg-[#FAF8F5] border-r border-slate-300 sticky left-0 z-10 text-center">
                      AVG
                    </td>
                    {monthlySummaryStats.map((stat) => (
                      <td key={`avg-${stat.month}`} className="py-2.5 px-2 border-r border-slate-100 font-bold text-slate-800">
                        {stat.avg ? (
                          <span className="font-bold text-[#1E331B] bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded border border-emerald-200 inline-block min-w-[58px]">
                            {stat.avg}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* MAX Row */}
                  <tr className="hover:bg-amber-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-black text-slate-800 bg-[#FAF8F5] border-r border-slate-300 sticky left-0 z-10 text-center">
                      MAX
                    </td>
                    {monthlySummaryStats.map((stat) => (
                      <td key={`max-${stat.month}`} className="py-2.5 px-2 border-r border-slate-100 font-bold text-slate-800">
                        {stat.max ? (
                          <span className="font-bold text-emerald-800 bg-emerald-100/70 text-emerald-950 px-2 py-0.5 rounded border border-emerald-300 inline-block min-w-[58px]">
                            {stat.max}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* MIN Row */}
                  <tr className="hover:bg-amber-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-black text-slate-800 bg-[#FAF8F5] border-r border-slate-300 sticky left-0 z-10 text-center">
                      MIN
                    </td>
                    {monthlySummaryStats.map((stat) => (
                      <td key={`min-${stat.month}`} className="py-2.5 px-2 border-r border-slate-100 font-bold text-slate-800">
                        {stat.min ? (
                          <span className="font-bold text-rose-800 bg-rose-50 text-rose-950 px-2 py-0.5 rounded border border-rose-200 inline-block min-w-[58px]">
                            {stat.min}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* TAB 1: LIVE PIVOT MATRIX & CONTROL SIDEBAR */}
      {activeTab === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT SIDEBAR CONTROLS */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4">
            
            {/* BASE RATE CARD */}
            <div className="bg-white rounded-2xl p-4 border border-[#E8E2D5] shadow-sm relative overflow-hidden">
              <div className="bg-[#1E331B] text-white -mx-4 -mt-4 p-3 mb-4 rounded-t-2xl flex items-center justify-between border-b-2 border-[#D4AF37]">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#D4AF37]" />
                  <h3 className="text-xs font-black uppercase tracking-wider">Configure Base Rate</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {latestRateRecord?.updated_by && (
                    <span className="text-[9px] bg-[#174C2C] text-amber-300 border border-[#2D7344] px-2 py-0.5 rounded-full font-bold">
                      By: {latestRateRecord.updated_by}
                    </span>
                  )}
                  <span className="text-[9px] bg-[#D4AF37] text-[#1E331B] px-2 py-0.5 rounded-full font-bold">Active Schedule</span>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="current_base_rate_1323" className="block text-[10px] font-black text-slate-700 uppercase tracking-wider">
                      Current Base Rate (₹)
                    </label>
                    {latestRateRecord?.updated_by && (
                      <span className="text-[9.5px] font-bold text-emerald-800">
                        Updated By: <strong className="text-[#1E331B] underline">{latestRateRecord.updated_by}</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-500">₹</span>
                    <input
 id="current_base_rate_1323" name="current_base_rate" aria-label="Current Base Rate (₹)"                      type="number"
                      value={baseRate}
                      onChange={(e) => setBaseRate(Number(e.target.value) || 0)}
                      className="w-full bg-[#FAF8F5] border-2 border-[#1E331B] font-mono font-black text-base text-[#1E331B] pl-7 pr-3 py-2 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
                      required
                    />
                  </div>
                  {latestRateRecord && (
                    <div className="text-[9.5px] text-slate-500 font-medium flex items-center justify-between mt-1 px-0.5">
                      <span>Database Rate: <strong className="font-mono text-slate-800 font-bold">₹{Number(latestRateRecord.base_rate).toLocaleString('en-IN')}</strong></span>
                      <span className="text-[9px] font-bold text-slate-600">
                        {latestRateRecord.created_at ? new Date(latestRateRecord.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="effective_date_1339" className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Effective Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
 id="effective_date_1339" name="effective_date" aria-label="Effective Date"                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-slate-300 font-mono font-bold text-xs pl-9 pr-3 py-2 rounded-xl outline-none focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="audit_remarks_1353" className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Audit Remarks
                  </label>
                  <textarea
 id="audit_remarks_1353" name="audit_remarks" aria-label="Audit Remarks"                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Log comments or reason for rate change..."
                    className="w-full bg-[#FAF8F5] border border-slate-300 font-medium text-xs p-2.5 rounded-xl outline-none focus:bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdateBaseRate}
                  disabled={isLoading}
                  className="w-full bg-[#1E331B] hover:bg-[#2A4726] text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4 text-[#D4AF37]" />
                  <span>{isLoading ? "Saving Rates..." : "Apply & Publish Base Rate"}</span>
                </button>
              </div>
            </div>

            {/* IMPORT CARD */}
            <div className="bg-white rounded-2xl p-4 border border-[#E8E2D5] shadow-sm">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-[#1E331B]" />
                  <h3 className="text-xs font-black uppercase text-[#1E331B]">Import CSV Chart Data</h3>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">.CSV Format</span>
              </div>

              <div className="space-y-3 text-xs">
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="w-full bg-[#FAF8F5] hover:bg-slate-100 text-[#1E331B] border border-slate-300 font-bold py-2 px-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Download CSV Template</span>
                </button>

                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleCsvUpload(file);
                  }}
                  className="border-2 border-dashed border-[#1E331B]/30 hover:border-[#1E331B] bg-[#FAF8F5] p-4 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center relative min-h-[90px]"
                  onClick={() => document.getElementById('satta-csv-file-input')?.click()}
                >
                  <Upload className="h-5 w-5 text-[#1E331B] mb-1" />
                  <span className="text-[10px] font-black text-[#1E331B] uppercase">
                    Drag & Drop CSV or Click
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 mt-0.5">
                    Headers: Area, Grade, Differential
                  </span>
                  <input
 name="file" aria-label="file"                    id="satta-csv-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCsvUpload(file);
                    }}
                  />
                </div>

                {isUploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>Uploading & Processing...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1E331B] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* IMPORT CARD */}

          </div>

          {/* RIGHT LIVE PIVOT MATRIX SPREADSHEET */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-3">
            
            {/* MATRIX CONTROL HEADER */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
 id="search_area_name_1499" name="search_area_name" aria-label="Search Area Name..."                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search Area Name..."
                    className="bg-[#FAF8F5] border border-slate-300 pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#1E331B] w-48"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Grade Filter Pills */}
                <div className="hidden sm:flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-slate-200 text-[10px] font-extrabold uppercase">
                  <button
                    onClick={() => setSelectedGradeFilter('ALL')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'ALL' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    All Grades ({ALL_GRADES.length})
                  </button>
                  <button
                    onClick={() => setSelectedGradeFilter('TD')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'TD' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    TD Series
                  </button>
                  <button
                    onClick={() => setSelectedGradeFilter('BTR')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'BTR' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    BTR Series
                  </button>
                  <button
                    onClick={() => setSelectedGradeFilter('MESTA')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'MESTA' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    Mesta
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCsvExport(
                    filteredSeedRows.flatMap(r => 
                      ALL_GRADES.map(g => {
                        const diffVal = dbDifferentials[r.area]?.[g] !== undefined ? dbDifferentials[r.area][g] : r.diffs[g];
                        return diffVal !== undefined ? { area: r.area, grade: g, base_rate: baseRate, differential: diffVal, final_rate: baseRate + diffVal, start_date: startDate } : null;
                      }).filter(Boolean)
                    ),
                    `Satta_Calculated_Matrix_${startDate}`
                  )}
                  className="bg-white hover:bg-slate-100 text-[#1E331B] border border-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Export Excel (CSV)</span>
                </button>

                <div className="bg-[#1E331B] text-white font-mono font-bold text-xs px-3 py-1.5 rounded-xl border border-[#D4AF37]/40 shadow-sm">
                  Base Rate: ₹{baseRate.toLocaleString()}
                </div>
              </div>
            </div>

            {/* COLOR CODING LEGEND */}
            <div className="bg-white p-2.5 rounded-xl border border-[#E8E2D5] flex flex-wrap items-center justify-between gap-2 text-[10px] font-extrabold uppercase">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5 text-[#D4AF37]" /> Color Legend:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#1E331B] text-white">Very High (≥+1000)</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">High Premium (&gt;0)</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">Equal / Base (0)</span>
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300">Low Discount (&lt;0)</span>
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">Critical (&lt;-1000)</span>
              </div>
            </div>

            {/* Inline Cell Differential Editor */}
            {editingCell && (
              <div className="p-3 border-2 border-emerald-600 bg-emerald-50 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-slideDown shadow-md">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-emerald-800" />
                  <span className="text-xs font-extrabold uppercase text-slate-800">
                    Edit Differential for <strong className="text-emerald-900">{editingCell.area}</strong> grade <strong className="text-emerald-900">{editingCell.grade}</strong>:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
 id="0_1590" name="0" aria-label="0"                    type="number"
                    value={editingCell.val}
                    onChange={(e) => setEditingCell({...editingCell, val: e.target.value})}
                    placeholder="0"
                    className="w-28 bg-white border border-slate-400 font-mono font-bold text-xs p-1.5 rounded-lg outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCellDifferential()}
                  />
                  <button
                    onClick={handleSaveCellDifferential}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-lg uppercase cursor-pointer shadow-sm"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingCell(null)} className="p-1.5 hover:bg-emerald-200 rounded-lg">
                    <X className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}

            {/* PIVOT MATRIX SPREADSHEET TABLE WITH FROZEN HEADER & FIRST COLUMN */}
            <div className="bg-white rounded-2xl border border-[#E8E2D5] shadow-md overflow-hidden relative">
              
              {/* Tooltip Hover Overlay */}
              {hoveredCell && (
                <div className="absolute top-2 right-4 z-20 bg-[#1E331B] text-white p-2.5 rounded-xl shadow-2xl border border-[#D4AF37] text-xs font-mono animate-fadeIn flex items-center gap-3">
                  <div>
                    <span className="text-[#D4AF37] font-bold block text-[10px]">{hoveredCell.area} • {hoveredCell.grade}</span>
                    <span className="text-white font-extrabold text-sm">Calculated: ₹{hoveredCell.rate.toLocaleString()}</span>
                  </div>
                  <div className="border-l border-white/20 pl-3">
                    <span className="text-slate-300 text-[10px] block">Differential Offset</span>
                    <span className={cn("font-bold text-xs", hoveredCell.diff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {hoveredCell.diff >= 0 ? `+₹${hoveredCell.diff}` : `-₹${Math.abs(hoveredCell.diff)}`}
                    </span>
                    {dbDiffUsers[hoveredCell.area]?.[hoveredCell.grade]?.user && (
                      <span className="text-[9px] text-amber-300 block font-sans font-bold mt-0.5">
                        Updated by: {dbDiffUsers[hoveredCell.area][hoveredCell.grade].user}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-auto max-h-[620px] scrollbar-thin">
                <table className="w-full text-left border-collapse font-sans text-xs min-w-[1300px]">
                  <thead className="bg-[#1E331B] text-white font-black uppercase text-[10px] tracking-wider sticky top-0 z-20 shadow-sm">
                    <tr className="border-b-2 border-[#D4AF37]">
                      <th className="p-3 border-r border-[#162B14] sticky left-0 bg-[#1E331B] text-left min-w-[170px] shadow-[3px_0_6px_rgba(0,0,0,0.2)] z-30">
                        Area Name ({filteredSeedRows.length})
                      </th>
                      {visibleGrades.map(g => (
                        <th key={g} className="p-2.5 text-center border-r border-[#162B14] font-mono min-w-[80px]">
                          {g}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-medium">
                    {filteredSeedRows.map((row, idx) => {
                      const areaName = row.area;
                      return (
                        <tr key={areaName} className={cn("hover:bg-[#FAF8F5] transition-colors uppercase", idx % 2 === 0 ? "bg-[#FAF8F5]/50" : "bg-white")}>
                          
                          {/* Frozen First Column: Area Name */}
                          <td className="p-3 border-r border-slate-300 font-extrabold text-[#1E331B] bg-white sticky left-0 z-10 shadow-[3px_0_6px_rgba(0,0,0,0.06)] flex items-center justify-between">
                            <span>{areaName}</span>
                            <ChevronRight className="h-3 w-3 text-slate-300" />
                          </td>

                          {/* Dynamic Grade Cells */}
                          {visibleGrades.map(grade => {
                            const diffVal = dbDifferentials[areaName]?.[grade] !== undefined
                              ? dbDifferentials[areaName][grade]
                              : row.diffs[grade];
                            
                            const hasDiff = diffVal !== undefined;
                            const finalComputedRate = hasDiff ? baseRate + diffVal : null;
                            const isVeryHigh = hasDiff && diffVal >= 1000;
                            const isHigh = hasDiff && diffVal > 0 && diffVal < 1000;
                            const isBase = hasDiff && diffVal === 0;
                            const isLow = hasDiff && diffVal < 0 && diffVal >= -1000;
                            const isCritical = hasDiff && diffVal < -1000;

                            return (
                              <td
                                key={grade}
                                onMouseEnter={() => hasDiff && setHoveredCell({ area: areaName, grade, diff: diffVal, rate: finalComputedRate! })}
                                onMouseLeave={() => setHoveredCell(null)}
                                onClick={() => {
                                  if (!enforceEditOrDeletePermission("Edit")) return;
                                  setEditingCell({
                                    area: areaName,
                                    grade: grade,
                                    val: hasDiff ? String(diffVal) : ''
                                  });
                                }}
                                className={cn(
                                  "p-1.5 border-r border-slate-200 text-center font-bold relative group cursor-pointer transition-all hover:ring-2 hover:ring-[#1E331B] hover:z-10",
                                  hasDiff
                                    ? isVeryHigh
                                      ? "bg-[#1E331B] text-white shadow-sm font-black"
                                      : isHigh
                                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                        : isBase
                                          ? "bg-amber-50 text-amber-900 border-amber-200"
                                          : isLow
                                            ? "bg-orange-50 text-orange-950 border-orange-200"
                                            : "bg-rose-50 text-rose-950 font-black border-rose-200"
                                    : "text-slate-300 font-normal italic"
                                )}
                              >
                                {hasDiff ? (
                                  <div className="flex flex-col justify-center items-center">
                                    <span className="text-[10.5px] font-mono font-black">₹{finalComputedRate?.toLocaleString()}</span>
                                    <div className="flex items-center gap-1">
                                      <span className={cn(
                                        "text-[8.5px] font-extrabold font-mono",
                                        isVeryHigh ? "text-[#D4AF37]" :
                                        isHigh ? "text-emerald-700" :
                                        isBase ? "text-amber-800" :
                                        isLow ? "text-orange-700" : "text-rose-700"
                                      )}>
                                        {diffVal >= 0 ? `+${diffVal}` : diffVal}
                                      </span>
                                      {dbDiffUsers[areaName]?.[grade]?.user && (
                                        <span 
                                          className="text-[7px] text-slate-500 font-sans truncate max-w-[45px] font-medium"
                                          title={`Updated by: ${dbDiffUsers[areaName][grade].user}`}
                                        >
                                          • {dbDiffUsers[areaName][grade].user}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-slate-300 group-hover:text-slate-600">--</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: DEDICATED DIFFERENTIAL HISTORY AUDIT VIEW */}
      {activeTab === 'diff_history' && (
        <div className="space-y-4">
          {/* HEADER & TOP ACTIONS */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#E8E2D5] shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#1E331B] text-[#D4AF37] rounded-2xl shadow-inner">
                <History className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-[#1E331B] tracking-tight font-serif">
                    Differential History
                  </h2>
                  <span className="text-[10px] font-sans font-extrabold bg-[#D4AF37] text-[#1E331B] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Live Supabase Audit
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#1E331B]" />
                <span>Open Live Matrix</span>
              </button>

              <button
                type="button"
                onClick={fetchDiffHistory}
                disabled={isDiffHistoryLoading}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCcw className={cn("h-3.5 w-3.5", isDiffHistoryLoading && "animate-spin")} />
                <span>{isDiffHistoryLoading ? "Refreshing..." : "Refresh"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const exportRows = filteredDiffHistoryLogs.map((log: any, idx: number) => ({
                    "Srl": idx + 1,
                    "Date": formatDateDMY(log.changed_date),
                    "Area Name": log.area,
                    "Grade": log.grade,
                    "Previous Differential": log.old_differential !== null && log.old_differential !== undefined ? log.old_differential : '',
                    "New Differential": log.new_differential !== null && log.new_differential !== undefined ? log.new_differential : '',
                    "Change": log.differential_change !== null && log.differential_change !== undefined ? (log.differential_change > 0 ? `+${log.differential_change}` : log.differential_change) : '',
                    "Changed By": log.changed_by || 'ADMIN',
                    "Changed At": formatDateTime(log.created_at),
                    "Remarks": log.remarks || ''
                  }));
                  handleCsvExport(exportRows, `Differential_History_${new Date().toISOString().split('T')[0]}.csv`);
                }}
                disabled={filteredDiffHistoryLogs.length === 0}
                className="px-3.5 py-2 bg-[#1E331B] hover:bg-[#2A4726] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* FILTERS TOOLBAR */}
          <div className="bg-white p-4 rounded-2xl border border-[#E8E2D5] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E331B] uppercase tracking-wider">
                <Filter className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span>Audit Filters</span>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-[#1E331B] font-black">{filteredDiffHistoryLogs.length}</strong> of {diffHistoryLogs.length} audit entries
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Search</label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={diffFilterSearch}
                    onChange={(e) => setDiffFilterSearch(e.target.value)}
                    placeholder="Search Area, Grade, User..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
                  />
                  {diffFilterSearch && (
                    <button
                      type="button"
                      onClick={() => setDiffFilterSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Date From</label>
                <input
                  type="date"
                  value={diffFilterDateFrom}
                  onChange={(e) => setDiffFilterDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white font-mono"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Date To</label>
                <input
                  type="date"
                  value={diffFilterDateTo}
                  onChange={(e) => setDiffFilterDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white font-mono"
                />
              </div>

              {/* Area Name Dropdown */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Area Name</label>
                <select
                  value={diffFilterArea}
                  onChange={(e) => setDiffFilterArea(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
                >
                  <option value="ALL">All Areas ({distinctDiffAreas.length})</option>
                  {distinctDiffAreas.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Grade Dropdown */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Grade</label>
                <select
                  value={diffFilterGrade}
                  onChange={(e) => setDiffFilterGrade(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"
                >
                  <option value="ALL">All Grades ({distinctDiffGrades.length})</option>
                  {distinctDiffGrades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-row for Changed By & Reset */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Changed By:</span>
                  <select
                    value={diffFilterChangedBy}
                    onChange={(e) => setDiffFilterChangedBy(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="ALL">All Users ({distinctDiffUsers.length})</option>
                    {distinctDiffUsers.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {(diffFilterSearch || diffFilterDateFrom || diffFilterDateTo || diffFilterArea !== 'ALL' || diffFilterGrade !== 'ALL' || diffFilterChangedBy !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiffFilterSearch('');
                      setDiffFilterDateFrom('');
                      setDiffFilterDateTo('');
                      setDiffFilterArea('ALL');
                      setDiffFilterGrade('ALL');
                      setDiffFilterChangedBy('ALL');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* AUDIT TABLE */}
          <div className="bg-white rounded-2xl border border-[#E8E2D5] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1E331B] text-white text-xs font-black uppercase tracking-wider border-b-2 border-[#D4AF37]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Area Name</th>
                    <th className="py-3 px-4">Grade</th>
                    <th className="py-3 px-4 text-right">Previous Differential</th>
                    <th className="py-3 px-4 text-right">New Differential</th>
                    <th className="py-3 px-4 text-center">Change</th>
                    <th className="py-3 px-4 text-center">Changed By</th>
                    <th className="py-3 px-4 text-right">Changed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {isDiffHistoryLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <RefreshCcw className="h-6 w-6 text-[#D4AF37] animate-spin mx-auto mb-2" />
                        <div className="font-bold text-slate-700">Loading Differential History from Supabase...</div>
                      </td>
                    </tr>
                  ) : filteredDiffHistoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <div className="font-bold text-slate-700">No Differential History Found</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {diffHistoryLogs.length > 0 
                            ? "Try adjusting your filters above to see more records." 
                            : "Edits made in Live Pivot Matrix will automatically appear here."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDiffHistoryLogs.map((log: any) => {
                      const changeVal = log.differential_change;
                      const hasChange = changeVal !== null && changeVal !== undefined;
                      const isPositive = hasChange && changeVal > 0;
                      const isNegative = hasChange && changeVal < 0;

                      return (
                        <tr key={log.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {formatDateDMY(log.changed_date)}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-[#1E331B] whitespace-nowrap">
                            {log.area}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md font-mono font-black text-xs bg-slate-100 text-slate-800 border border-slate-300">
                              {log.grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                            {log.old_differential !== null && log.old_differential !== undefined ? (
                              <span className={cn(
                                "font-bold",
                                log.old_differential > 0 ? "text-emerald-700" : log.old_differential < 0 ? "text-rose-700" : "text-slate-700"
                              )}>
                                {log.old_differential > 0 ? `+${log.old_differential}` : log.old_differential}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                            {log.new_differential !== null && log.new_differential !== undefined ? (
                              <span className={cn(
                                "font-black text-sm",
                                log.new_differential > 0 ? "text-emerald-800" : log.new_differential < 0 ? "text-rose-800" : "text-slate-800"
                              )}>
                                {log.new_differential > 0 ? `+${log.new_differential}` : log.new_differential}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {hasChange ? (
                              <span className={cn(
                                "inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-black",
                                isPositive 
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : isNegative 
                                  ? "bg-rose-100 text-rose-800 border border-rose-300"
                                  : "bg-slate-100 text-slate-600 border border-slate-300"
                              )}>
                                {isPositive && <ArrowUpRight className="h-3 w-3 text-emerald-700" />}
                                {isNegative && <ArrowDownRight className="h-3 w-3 text-rose-700" />}
                                {isPositive ? `+${changeVal}` : changeVal}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300">
                              {log.changed_by || 'ADMIN'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PROPOSED RATE CHANGE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white border-4 border-[#1E331B] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans">
            <div className="flex items-center gap-3 border-b pb-3 border-slate-200">
              <AlertCircle className="h-6 w-6 text-[#1E331B]" />
              <h3 className="text-sm font-black uppercase text-[#1E331B] tracking-wider">Confirm Published Rate Schedule</h3>
            </div>

            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-slate-300 font-mono text-xs space-y-2 uppercase">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Proposed Base Rate:</span>
                <span className="font-black text-[#1E331B]">₹{baseRate.toLocaleString()}</span>
              </div>
              {latestRateRecord && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Current Base Rate:</span>
                  <span className="font-bold text-slate-600">₹{Number(latestRateRecord.base_rate).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Effective Date:</span>
                <span className="font-black text-[#1E331B]">{formatDateDMY(startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Audit Note:</span>
                <span className="font-bold text-slate-700 truncate max-w-[140px]">"{remarks}"</span>
              </div>
            </div>

            {duplicateCheckResult.hasDuplicate ? (
              <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-amber-950 text-xs font-medium">
                ⚠️ Existing records exist on {formatDateDMY(startDate)}. Proceeding will replace previous logs on this date to prevent duplicates.
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl text-emerald-950 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Validation Passed! Ready to calculate matrix.</span>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 text-xs font-extrabold uppercase">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRateUpdate}
                className="px-4 py-2 bg-[#1E331B] text-white rounded-xl shadow hover:bg-[#2A4726] flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-4 w-4 text-[#D4AF37]" />
                <span>Publish Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border-2 border-[#D4AF37] my-auto overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-[#1E331B] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#D4AF37] print:hidden">
              <div className="flex items-center gap-2.5">
                <Printer className="h-5 w-5 text-[#D4AF37]" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Print Preview — Satta Chart Base Rate ({selectedYear})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-[#D4AF37] hover:bg-[#C5A059] text-[#1E331B] font-black px-4 py-1.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Section */}
            <div id="satta-print-area" className="p-6 md:p-8 bg-white text-slate-900 font-sans print:p-0">
              <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
                <h1 className="text-xl md:text-2xl font-black font-serif tracking-tight text-slate-900 uppercase">
                  SATTA CHART BASE RATE
                </h1>
                <div className="text-sm font-bold text-slate-700 mt-1">
                  Bally Jute Company Limited • Jute Season Base Rate Schedule
                </div>
                <div className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                  Year: {selectedYear} • Source: Supabase Base Rate Master
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse border border-slate-900 text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-900 font-black uppercase">
                      <th className="py-2 px-2 border-r border-slate-900 w-12 text-slate-900">Date</th>
                      {MONTH_COLS.map((m) => (
                        <th key={m.name} className="py-2 px-2 border-r border-slate-900 text-slate-900">
                          {m.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 font-mono text-[11px]">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                      const dayStr = String(day).padStart(2, '0');
                      return (
                        <tr key={day} className="border-b border-slate-300">
                          <td className="py-1.5 px-2 font-bold bg-slate-50 border-r border-slate-900 text-slate-900">
                            {dayStr}
                          </td>
                          {MONTH_COLS.map((m) => {
                            const targetYear = selectedYear + (m.yearOffset || 0);
                            const dateKey = `${targetYear}-${m.month}-${dayStr}`;
                            const hasDay = day <= m.days;
                            const rateVal = hasDay ? rateLookup.get(dateKey) : null;

                            return (
                              <td key={m.name} className="py-1.5 px-1.5 border-r border-slate-400 text-slate-900">
                                {rateVal && rateVal > 0 ? (
                                  <span className="font-bold">{rateVal.toLocaleString('en-IN')}</span>
                                ) : (
                                  <span className="text-slate-400 font-normal">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Print Preview Monthly Summary Table */}
              <div className="mt-4 overflow-x-auto">
                <div className="text-[11px] font-black uppercase text-slate-900 mb-1">
                  Monthly Base Rate Summary (AVG / MAX / MIN)
                </div>
                <table className="w-full text-center border-collapse border border-slate-900 text-[11px] font-mono">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-900 font-black">
                      <th className="py-1.5 px-2 border-r border-slate-900 w-12 text-slate-900 text-center">Metric</th>
                      {MONTH_COLS.map((m) => (
                        <th key={m.name} className="py-1.5 px-1.5 border-r border-slate-900 text-slate-900">
                          {m.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400">
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-bold bg-slate-50 border-r border-slate-900 text-slate-900">AVG</td>
                      {monthlySummaryStats.map((stat) => (
                        <td key={`print-avg-${stat.month}`} className="py-1 px-1 border-r border-slate-400 font-bold">
                          {stat.avg || '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-bold bg-slate-50 border-r border-slate-900 text-slate-900">MAX</td>
                      {monthlySummaryStats.map((stat) => (
                        <td key={`print-max-${stat.month}`} className="py-1 px-1 border-r border-slate-400 font-bold">
                          {stat.max || '—'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-bold bg-slate-50 border-r border-slate-900 text-slate-900">MIN</td>
                      {monthlySummaryStats.map((stat) => (
                        <td key={`print-min-${stat.month}`} className="py-1 px-1 border-r border-slate-400 font-bold">
                          {stat.min || '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500 font-medium print:mt-4">
                <span>Generated by Bally Jute ERP Base Rate Module</span>
                <span>Page 1 of 1 • Official Satta Matrix</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintPreview(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-[#1E331B] hover:bg-[#2A4726] text-white font-black px-5 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow cursor-pointer active:scale-95"
              >
                <Printer className="h-4 w-4 text-[#D4AF37]" />
                <span>Print Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Satta Chart Upload Success Modal */}
      {showUploadSuccessModal && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-emerald-500 space-y-4 text-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 border-2 border-emerald-400 rounded-2xl flex items-center justify-center text-emerald-700 shadow-inner">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-emerald-300">
                  Step 1 Complete
                </span>
                <h3 className="text-base font-black uppercase tracking-tight text-emerald-950 mt-0.5">
                  Satta Chart Uploaded Successfully
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The required <strong>Satta Chart</strong> differentials have been saved to Supabase and verified. You may now proceed directly to <strong>NEW SAUDA CONTRACT ENTRY</strong>.
            </p>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 text-[11px] text-emerald-900 space-y-1">
              <div className="flex justify-between font-bold">
                <span>Active Status:</span>
                <span className="text-emerald-700 font-extrabold">Verified & Published</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Next Allowed Operation:</span>
                <span className="text-slate-900 font-extrabold">New Sauda Contract Entry</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUploadSuccessModal(false);
                  if (onNavigate) {
                    onNavigate('sauda_entry');
                  } else {
                    window.dispatchEvent(new CustomEvent('app-navigate', { detail: { page: 'sauda_entry' } }));
                  }
                }}
                className="flex-1 bg-[#174C2C] hover:bg-[#1f633a] text-amber-300 font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <span>Proceed to NEW SAUDA CONTRACT ENTRY</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
              <button
                type="button"
                onClick={() => setShowUploadSuccessModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Stay on Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Change Log Modal */}
      <UniversalAuditLogModal
        isOpen={showUniversalAuditModal}
        onClose={() => setShowUniversalAuditModal(false)}
        initialModule="Satta Desk / Rate Chart"
      />

    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <LegacyLayout title="Satta Dashboard" subtitle="Live Market Intelligence & Rate Chart Console">
      {content}
    </LegacyLayout>
  );
}
