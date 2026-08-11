import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Package, 
  Search, 
  Download, 
  Printer, 
  ArrowRight,
  TrendingUp,
  Box,
  Layers,
  Archive,
  ChevronDown,
  Clock,
  LayoutDashboard,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Edit,
  Trash2,
  Calendar,
  AlertTriangle,
  RefreshCw,
  MapPin,
  FileText,
  History,
  FileSpreadsheet,
  Info,
  Sparkles,
  ClipboardList,
  Percent
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie 
} from 'recharts';
import { cn, sanitizeCsvData, canDeleteData } from '../lib/utils';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import MaterialIssue from './MaterialIssue';
import PrintModal from '../components/PrintModal';

const FALLBACK_GODOWNS = [
  { gdn_code: 'GDN-01', gdn_name: 'MAIN GODOWN' },
  { gdn_code: 'GDN-02', gdn_name: 'GODOWN-B' },
  { gdn_code: 'GDN-03', gdn_name: 'GDW-A (RAW MAIN)' },
];

const FALLBACK_GRADES = [
  { code: 'TD-5', name: 'RAW JUTE - TOSSA TD-5' },
  { code: 'W-5', name: 'RAW JUTE - WHITE W-5' },
  { code: 'M-1', name: 'MESTA M-1' },
  { code: 'SUPER', name: 'BIMLI SUPER' },
  { code: 'TD-4', name: 'TOSSA TD-4 (OLD)' },
];

const FALLBACK_AREAS = [
  { name: 'KISHANGANJ' },
  { name: 'FORBESGANJ' },
  { name: 'ISLAMPUR' },
  { name: 'VIZIANAGARAM' },
];

const FALLBACK_UNITS = [
  { unit_name: 'BALES' },
  { unit_name: 'DRUMS' },
  { unit_name: 'LOOSE' },
  { unit_name: 'P.BALES' },
  { unit_name: 'H.BALES' },
];

const DEFAULT_GODOWNS = [
  { gdn_code: "1", gdn_name: "1", gdn_capacity: 600, gdn_short_name: "1" },
  { gdn_code: "2", gdn_name: "3", gdn_capacity: 450, gdn_short_name: "3" },
  { gdn_code: "3", gdn_name: "3A", gdn_capacity: 450, gdn_short_name: "3A" },
  { gdn_code: "4", gdn_name: "4", gdn_capacity: 450, gdn_short_name: "4" },
  { gdn_code: "5", gdn_name: "4A", gdn_capacity: 450, gdn_short_name: "4A" },
  { gdn_code: "6", gdn_name: "4B", gdn_capacity: 600, gdn_short_name: "4B" },
  { gdn_code: "7", gdn_name: "4C", gdn_capacity: 600, gdn_short_name: "4C" },
  { gdn_code: "8", gdn_name: "5", gdn_capacity: 450, gdn_short_name: "5" },
  { gdn_code: "9", gdn_name: "6", gdn_capacity: 450, gdn_short_name: "6" },
  { gdn_code: "10", gdn_name: "6A", gdn_capacity: 450, gdn_short_name: "6A" },
  { gdn_code: "11", gdn_name: "7", gdn_capacity: 450, gdn_short_name: "7" },
  { gdn_code: "12", gdn_name: "7A", gdn_capacity: 450, gdn_short_name: "7A" },
  { gdn_code: "13", gdn_name: "8", gdn_capacity: 450, gdn_short_name: "8" },
  { gdn_code: "14", gdn_name: "8A", gdn_capacity: 450, gdn_short_name: "8A" },
  { gdn_code: "15", gdn_name: "9", gdn_capacity: 450, gdn_short_name: "9" },
  { gdn_code: "16", gdn_name: "9A", gdn_capacity: 450, gdn_short_name: "9A" },
  { gdn_code: "17", gdn_name: "10", gdn_capacity: 450, gdn_short_name: "10" },
  { gdn_code: "18", gdn_name: "2", gdn_capacity: 450, gdn_short_name: "2" },
  { gdn_code: "19", gdn_name: "1A", gdn_capacity: 450, gdn_short_name: "1A" },
  { gdn_code: "20", gdn_name: "OUTSIDE", gdn_capacity: 500, gdn_short_name: "OS" },
  { gdn_code: "21", gdn_name: "2A", gdn_capacity: 450, gdn_short_name: "2A" },
  { gdn_code: "22", gdn_name: "INSP. MILL", gdn_capacity: 450, gdn_short_name: "IM" },
  { gdn_code: "23", gdn_name: "KATARI", gdn_capacity: 450, gdn_short_name: "KATA" },
  { gdn_code: "24", gdn_name: "MILL", gdn_capacity: 450, gdn_short_name: "MILL" },
  { gdn_code: "26", gdn_name: "STB", gdn_capacity: 450, gdn_short_name: "STB" },
  { gdn_code: "27", gdn_name: "INSP. STB", gdn_capacity: 450, gdn_short_name: "ISTB" },
  { gdn_code: "29", gdn_name: "INSP. KATARI", gdn_capacity: 450, gdn_short_name: "IKAT" },
  { gdn_code: "30", gdn_name: "SELECTION SHED", gdn_capacity: 450, gdn_short_name: "SHED" },
  { gdn_code: "31", gdn_name: "8B", gdn_capacity: 450, gdn_short_name: "8B" }
];

export default function StockSummary({ onClose, initialSubTab = 'opening' }: { onClose?: () => void; initialSubTab?: 'opening' | 'closing' }) {
  // Navigation Tabs: 'opening' (CRUD Dashboard) vs 'live' (Dynamic calculations summary)
  const [activeTab, setActiveTab] = useState<'opening' | 'live'>('opening');
  // Sub-tabs for switching between Opening Stock ledger and Closing Stock ledger
  const [stockSubTab, setStockSubTab] = useState<'opening' | 'closing'>(initialSubTab);

  // Standard Live Reports & Total Counts
  const [counts, setCounts] = useState({ amad: 0, sauda: 0, total_bales: 0 });

  // Dropdown Metadata fetched from Supabase
  const [godowns, setGodowns] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  // Saved Opening & Closing Stock rows
  const [openingStocks, setOpeningStocks] = useState<any[]>([]);
  const [closingStocks, setClosingStocks] = useState<any[]>([]);
  const [godownWiseStocks, setGodownWiseStocks] = useState<any[]>([]);
  const [millIssueMasters, setMillIssueMasters] = useState<any[]>([]);
  const [millIssueDetails, setMillIssueDetails] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [metricCalculationMode, setMetricCalculationMode] = useState<'cumulative' | 'period'>('cumulative');
  const [loading, setLoading] = useState(false);

  // Form input states for Opening Stock
  const [formState, setFormState] = useState({
    id: '',
    opening_date: new Date().toISOString().split('T')[0],
    godown: '',
    area: '',
    grade: '',
    jci: 'No',
    unit: 'BALES',
    quantity: '',
    weight: '',
    avg_weight: ''
  });

  // Form input states for Closing Stock
  const [closingFormState, setClosingFormState] = useState({
    id: '',
    stock_date: new Date().toISOString().split('T')[0],
    godown: '',
    commodity: 'RAW JUTE',
    variety: 'TOSSA',
    grade: '',
    no_of_bales: '',
    weight_qtl: '',
    rate_per_qtl: '6500',
    total_value: '0',
    remarks: '',
    recorded_by: 'ADMIN'
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  
  // Selection, Printing, and Audit Trail state hooks
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [selectedClosingStockId, setSelectedClosingStockId] = useState<string | null>(null);

    const [isPrintingModalOpen, setIsPrintingModalOpen] = useState(false);
  const [isClosingPrintModalOpen, setIsClosingPrintModalOpen] = useState(false);

  const [printData, setPrintData] = useState<any | null>(null);
  const [printClosingData, setPrintClosingData] = useState<any | null>(null);

  const [showCapacityPopup, setShowCapacityPopup] = useState(false);
  const [popupSearchQuery, setPopupSearchQuery] = useState("");

  const getGodownCapacityAndName = (gdnVal: string) => {
    const valStr = String(gdnVal || '').trim();
    if (!valStr) {
      return { name: "No Godown Selected", capacity: 0 };
    }
    let found = DEFAULT_GODOWNS.find(
      g => String(g.gdn_name || '').trim().toLowerCase() === valStr.toLowerCase() ||
           String(g.gdn_short_name || '').trim().toLowerCase() === valStr.toLowerCase()
    );
    if (!found) {
      found = DEFAULT_GODOWNS.find(
        g => String(g.gdn_code || '').trim().toLowerCase() === valStr.toLowerCase()
      );
    }
    if (found) {
      return {
        name: found.gdn_name,
        capacity: Number(found.gdn_capacity || 450)
      };
    }

    if (valStr === '1' || valStr.toUpperCase() === 'GDN-01') return { name: "1", capacity: 600 };
    if (valStr === '2') return { name: "2", capacity: 450 };
    if (valStr === '3') return { name: "3", capacity: 450 };
    if (valStr === '3A') return { name: "3A", capacity: 450 };
    if (valStr === '4') return { name: "4", capacity: 450 };
    if (valStr === '4A') return { name: "4A", capacity: 450 };
    if (valStr === '4B') return { name: "4B", capacity: 600 };
    if (valStr === '5') return { name: "5", capacity: 450 };

    return {
      name: valStr,
      capacity: 450
    };
  };

  
  const [showCustomGradeClosing, setShowCustomGradeClosing] = useState(false);
  const [customGradeValueClosing, setCustomGradeValueClosing] = useState('');

  // Dual loading logic for Live Valuation counts and Master Dropdowns/Data
  useEffect(() => {
    async function initPage() {
      setLoading(true);
      try {
        // 1. Fetch amad & sauda counts
        const [amad, sauda] = await Promise.all([
          dbModule.fetchAll('temporary_material_received').catch(() => []),
          dbModule.fetchAll('sauda_master').catch(() => [])
        ]);
        setCounts({ 
          amad: amad.length, 
          sauda: sauda.reduce((acc: number, curr: any) => acc + (Number(curr.pkts) || 0), 0),
          total_bales: amad.reduce((acc: number, curr: any) => acc + (Number(curr.packets) || 0), 0)
        });

        // 2. Fetch masters and saved opening/closing stock entries
        await Promise.all([
          fetchDropdowns(),
          loadOpeningStocks(),
          loadClosingStocks(),
          loadMillIssuesAndGodownWiseStocks()
        ]);
      } catch (err) {
        console.error("Initialization warning:", err);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  // Draft auto-save and restore disabled to ensure form is always a fresh blank form on open, per user request

  const fetchDropdowns = async () => {
    if (!supabase) return;
    try {
      // Fetch godown, grade, and area
      const [gdnRes, grdRes, arRes] = await Promise.all([
        supabase.from('godown_master').select('*').limit(150),
        supabase.from('grade_master').select('*').limit(150),
        supabase.from('area_master').select('*').limit(150),
      ]);

      if (gdnRes.data && gdnRes.data.length > 0) {
        const sortedGodowns = [...gdnRes.data].sort((a, b) => 
          String(a.gdn_name || '').localeCompare(String(b.gdn_name || ''))
        );
        setGodowns(sortedGodowns);
      }
      if (grdRes.data && grdRes.data.length > 0) {
        const sortedGrades = [...grdRes.data].sort((a, b) => 
          String(a.grade_name || a.name || '').localeCompare(String(b.grade_name || b.name || ''))
        );
        setGrades(sortedGrades);
      }
      if (arRes.data && arRes.data.length > 0) {
        const sortedAreas = [...arRes.data].sort((a, b) => 
          String(a.area_name || a.name || '').localeCompare(String(b.area_name || b.name || ''))
        );
        setAreas(sortedAreas);
      }

      // Dynamically load units from unit_master
      let fetchedUnits: any[] = [];
      try {
        const { data } = await supabase.from('unit_master').select('*').limit(150);
        if (data && data.length > 0) {
          fetchedUnits = data;
        }
      } catch (err) {
        console.warn("unit_master fetch failed", err);
      }

      if (fetchedUnits.length > 0) {
        const sortedUnits = fetchedUnits
          .map(u => ({ unit_name: String(u.unit_name || u.name || '').toUpperCase() }))
          .filter(u => u.unit_name)
          .sort((a, b) => a.unit_name.localeCompare(b.unit_name));
        
        const uniqueUnits = sortedUnits.filter((v, i, a) => a.findIndex(t => t.unit_name === v.unit_name) === i);
        setUnits(uniqueUnits);
      } else {
        setUnits(FALLBACK_UNITS);
      }
    } catch (err) {
      console.warn("Could not pre-fetch some metadata tables, using dynamic values.", err);
    }
  };

  const loadOpeningStocks = async () => {
    try {
      if (supabase) {
        const [opRes, gdnRes] = await Promise.all([
          supabase.from('opening_stock').select('*').order('opening_date', { ascending: false }),
          supabase.from('godown_wise_stock').select('*').order('stock_date', { ascending: false })
        ]);
        
        if (opRes.error) throw opRes.error;
        if (gdnRes.error) throw gdnRes.error;

        const opData = (opRes.data || []).map(r => ({
          ...r,
          stock_date: r.opening_date || r.stock_date || new Date().toISOString().split('T')[0],
          opening_date: r.opening_date || r.stock_date || new Date().toISOString().split('T')[0]
        }));
        
        const gdnData = (gdnRes.data || []).map(r => ({
          ...r,
          opening_date: r.stock_date || r.opening_date || new Date().toISOString().split('T')[0],
          stock_date: r.stock_date || r.opening_date || new Date().toISOString().split('T')[0]
        }));
        
        // Combine them and remove duplicates by ID just in case
        const combined = [...gdnData, ...opData];
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        
        setOpeningStocks(unique);
        localStorage.setItem('po_auto_opening_stock', JSON.stringify(unique));
        return;
      }
    } catch (err) {
      console.warn("Error loading saved opening stocks from Supabase, using localStorage fallback:", err);
    }

    // Local fallback
    const stored = localStorage.getItem('po_auto_opening_stock');
    if (stored && stored !== 'undefined' && stored !== 'null') {
      try {
        setOpeningStocks(JSON.parse(stored === "undefined" ? "null" : stored));
      } catch (e) {
        console.error("Failed to parse opening stocks from localStorage", e);
        setOpeningStocks([]);
      }
    } else {
      setOpeningStocks([]);
    }
  };

  const loadClosingStocks = async () => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('closing_stock')
          .select('*')
          .order('stock_date', { ascending: false });
        
        if (error) throw error;
        setClosingStocks(data || []);
        return;
      }
    } catch (err) {
      console.warn("Error loading closing stocks from Supabase, using localStorage fallback:", err);
    }

    // Fallback local storage
    const stored = localStorage.getItem('po_auto_closing_stock');
    if (stored && stored !== 'undefined' && stored !== 'null') {
      try {
        setClosingStocks(JSON.parse(stored === "undefined" ? "null" : stored));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const loadMillIssuesAndGodownWiseStocks = async () => {
    try {
      let gwsData: any[] = [];
      let mimData: any[] = [];
      let midData: any[] = [];

      if (supabase) {
        try {
          const [gwsRes, mimRes, midRes] = await Promise.all([
            supabase.from('godown_wise_stock').select('*'),
            supabase.from('mill_issue_master').select('*'),
            supabase.from('mill_issue_detail').select('*')
          ]);
          gwsData = gwsRes.data || [];
          mimData = mimRes.data || [];
          midData = midRes.data || [];
        } catch (se) {
          console.warn("Supabase fetch failed, falling back to dbModule", se);
        }
      }

      if (!gwsData || gwsData.length === 0) {
        gwsData = await dbModule.fetchAll('godown_wise_stock').catch(() => []);
      }
      if (!mimData || mimData.length === 0) {
        mimData = await dbModule.fetchAll('mill_issue_master').catch(() => []);
      }
      if (!midData || midData.length === 0) {
        midData = await dbModule.fetchAll('mill_issue_detail').catch(() => []);
      }

      setGodownWiseStocks(gwsData || []);
      setMillIssueMasters(mimData || []);
      setMillIssueDetails(midData || []);
    } catch (err) {
      console.warn("Could not load mill issues or godown wise stocks:", err);
    }
  };

  const handleClosingFieldChange = (field: string, value: string) => {
    setClosingFormState(prev => {
      const updated = { ...prev, [field]: value };
      
      // Estimation logic: 1 Bale is approx 0.52 Quintals
      if (field === 'no_of_bales') {
        const bales = parseFloat(value) || 0;
        updated.weight_qtl = String(Math.round(bales * 0.52 * 100) / 100);
      }
      
      const balesVal = parseFloat(updated.no_of_bales) || 0;
      const weightVal = parseFloat(updated.weight_qtl) || (Math.round(balesVal * 0.52 * 100) / 100);
      const rateVal = parseFloat(updated.rate_per_qtl) || 0;
      updated.total_value = String(Math.round(weightVal * rateVal * 100) / 100);
      
      return updated;
    });
  };

  // Helper methods for logging audits, exporting to CSV, and preparing print dialogs
  const logOpeningStockAudit = (action: 'CREATE' | 'UPDATE' | 'DELETE', details: string) => {
    try {
      const timestamp = new Date().toISOString();
      const user = localStorage.getItem("mill_operator_id") || "OPERATOR-01";
      const logEntry = {
        id: Math.random().toString(36).substring(2, 9),
        action,
        timestamp,
        user_id: user,
        details
      };
      const existing = (function(){
        try {
          const val = localStorage.getItem('mill_opening_stock_change_history');
          if (!val || val === 'undefined' || val === 'null') return [];
          const parsed = JSON.parse(val === "undefined" ? "null" : val);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      })();
      localStorage.setItem('mill_opening_stock_change_history', JSON.stringify([logEntry, ...existing]));
    } catch (e) {
      console.error("Failed to write opening stock audit log", e);
    }
  };

  const handleExportToCSV = () => {
    if (stockSubTab === 'opening') {
      if (filteredSavedStocks.length === 0) {
        alert("No opening stock data available to export.");
        return;
      }
      const dataToExport = filteredSavedStocks.map(row => ({
        'Opening Date': row.opening_date || '',
        'Godown / Warehouse': row.godown || '',
        'Area Station': row.area || '',
        'Grade Component': row.grade || '',
        'Govt Supplied (JCI)': row.jci || 'No',
        'Unit': row.unit || 'BALES',
        'Quantity': Number(row.quantity) || 0,
        'Weight (MT)': (Number(row.weight) || 0) / 10,
        'Avg Wt (MT/unit)': row.avg_weight ? (Number(row.avg_weight) / 10) : (Number(row.quantity) > 0 ? Number(((Number(row.weight) / Number(row.quantity)) / 10).toFixed(4)) : 0)
      }));
      triggerCSVDownload(dataToExport, 'Opening_Stock_Ledger_');
    } else {
      if (filteredClosingStocks.length === 0) {
        alert("No closing stock data available to export.");
        return;
      }
      const dataToExport = filteredClosingStocks.map(row => ({
        'Stock Date': row.stock_date || '',
        'Godown Location': row.godown || '',
        'Commodity': row.commodity || 'RAW JUTE',
        'Variety': row.variety || 'TOSSA',
        'Grade Component': row.grade || '',
        'No of Bales': Number(row.no_of_bales) || 0,
        'Weight (MT)': (Number(row.weight_qtl) || 0) / 10,
        'Rate per MT': (Number(row.rate_per_qtl) || 0) * 10,
        'Total Value (Rs)': Number(row.total_value) || 0,
        'Recorded By': row.recorded_by || 'ADMIN',
        'Remarks': row.remarks || ''
      }));
      triggerCSVDownload(dataToExport, 'Closing_Stock_Ledger_');
    }
  };

  const handleExportLiveStockToCSV = () => {
    // 1. Fetch dynamic live stock rows using the formula:
    // Opening + Issue to Godown (Incoming) - Godown to Factory (Outgoing)
    const liveRows = calculateLiveStocks();

    // 2. Map and filter by search query if any
    const allRows = liveRows.map(row => ({
      name: row.grade,
      opening: row.openingQty,
      incoming: row.incomingQty,
      outgoing: row.outgoingQty,
      balance: row.balanceQty,
      weight: row.balanceWt
    }));

    const filteredRows = allRows.filter(row => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return row.name.toLowerCase().includes(q);
    });

    if (filteredRows.length === 0) {
      alert("No live stock data available to export.");
      return;
    }

    const dataToExport = filteredRows.map(row => ({
      "Commodity Quality & Grade": row.name,
      "Opening Stock (Bales)": row.opening,
      "Issue to Godown (Bales)": row.incoming,
      "Godown to Factory (Bales)": row.outgoing,
      "Current Stock Balance (Bales)": row.balance,
      "Net Weight (MT)": Number((row.weight / 10).toFixed(2))
    }));

    triggerCSVDownload(dataToExport, "Live_Latest_Inventory_Report_");
  };

  const triggerCSVDownload = (data: any[], prefix: string) => {
    try {
      const sanitizedData = sanitizeCsvData(data);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${prefix}${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("Failed to export ledger data to CSV.");
    }
  };

  const handlePreparePrint = (row: any) => {
    setPrintData(row);
    setIsPrintingModalOpen(true);
    
    // Log printing event
    const timestamp = new Date().toISOString();
    const user = localStorage.getItem("mill_operator_id") || "OPERATOR-01";
    const logEntry = {
      id: Math.random().toString(36).substring(2, 9),
      user_id: user,
      timestamp,
      row_ids: [row.id || 'N/A'],
      details: `Printed Opening Stock Certificate for ${row.grade} @ ${row.godown} [Qty: ${row.quantity} ${row.unit}]`
    };
    try {
      const existingLogs = JSON.parse(localStorage.getItem("mill_inspection_print_logs") === "undefined" ? "[]" : (localStorage.getItem("mill_inspection_print_logs") || "[]"));
      localStorage.setItem("mill_inspection_print_logs", JSON.stringify([logEntry, ...existingLogs]));
    } catch (err) {
      console.error("Local print event log error:", err);
    }
  };

  const handlePrepareClosingPrint = (row: any) => {
    setPrintClosingData(row);
    setIsClosingPrintModalOpen(true);

    const timestamp = new Date().toISOString();
    const user = localStorage.getItem("mill_operator_id") || "OPERATOR-01";
    const logEntry = {
      id: Math.random().toString(36).substring(2, 9),
      user_id: user,
      timestamp,
      row_ids: [row.id || 'N/A'],
      details: `Printed Opening Stock Statement for ${row.grade} @ ${row.godown} [Bales: ${row.no_of_bales || row.quantity}, Value: Rs. ${row.total_value}]`
    };
    try {
      const existingLogs = JSON.parse(localStorage.getItem("mill_inspection_print_logs") === "undefined" ? "[]" : (localStorage.getItem("mill_inspection_print_logs") || "[]"));
      localStorage.setItem("mill_inspection_print_logs", JSON.stringify([logEntry, ...existingLogs]));
    } catch (err) {
      console.error(err);
    }
  };

    // Combine fetched metadata with static defaults so the dropdown is never empty
  const mergedGodowns = godowns.length > 0 ? godowns : FALLBACK_GODOWNS;
  const mergedGrades = grades.length > 0 ? grades : FALLBACK_GRADES;
  const mergedAreas = areas.length > 0 ? areas : FALLBACK_AREAS;
  const mergedUnits = units.length > 0 ? units : FALLBACK_UNITS;

  const resetForm = () => {
    setFormState({
      id: '',
      opening_date: new Date().toISOString().split('T')[0],
      godown: '',
      area: '',
      grade: '',
      jci: 'No',
      unit: 'BALES',
      quantity: '',
      weight: '',
      avg_weight: ''
    });
    setIsEditing(false);
    setSelectedStockId(null);
    try {
      localStorage.removeItem('AUTOSAVE_STOCK_SUMMARY');
    } catch (e) {
      console.warn(e);
    }
  };

  const resetClosingForm = () => {
    setClosingFormState({
      id: '',
      stock_date: new Date().toISOString().split('T')[0],
      godown: '',
      commodity: 'RAW JUTE',
      variety: 'TOSSA',
      grade: '',
      no_of_bales: '',
      weight_qtl: '',
      rate_per_qtl: '6500',
      total_value: '0',
      remarks: '',
      recorded_by: 'ADMIN'
    });
    setIsEditing(false);
    setShowCustomGradeClosing(false);
    setCustomGradeValueClosing('');
    setSelectedClosingStockId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supplied database client is offline.");
      return;
    }

    setLoading(true);
    const finalArea = (formState.area || '').toUpperCase().trim();
    const finalGrade = (formState.grade || '').toUpperCase().trim();
    const finalGodown = (formState.godown || '').toUpperCase().trim();
    const finalUnit = (formState.unit || 'BALES').toUpperCase().trim();

    if (!finalGodown) {
      alert("Please provide a valid Godown.");
      setLoading(false);
      return;
    }
    if (!finalArea) {
      alert("Please provide a valid Area name.");
      setLoading(false);
      return;
    }
    if (!finalGrade) {
      alert("Please provide a valid Grade specification.");
      setLoading(false);
      return;
    }

    const qty = parseFloat(formState.quantity) || 0;
    const wt = parseFloat(formState.weight) || 0;
    const calculatedAvg = qty > 0 ? parseFloat((wt / qty).toFixed(3)) : 0;

    const recordId = isEditing && formState.id ? formState.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'local-' + Date.now());

    const payload = {
      id: recordId,
      opening_date: formState.opening_date,
      stock_date: formState.opening_date,
      godown: finalGodown,
      area: finalArea,
      grade: finalGrade,
      jci: formState.jci,
      unit: finalUnit,
      quantity: qty,
      weight: wt,
      avg_weight: calculatedAvg,
    };

    try {
      let success = false;
      if (supabase && !String(recordId).startsWith('local-')) {
        try {
          const payloadOp = { ...payload };
          const payloadGdn = {
            id: recordId,
            stock_date: formState.opening_date,
            godown: finalGodown,
            area: finalArea,
            grade: finalGrade,
            jci: formState.jci,
            unit: finalUnit,
            quantity: qty,
            weight: wt,
            avg_weight: calculatedAvg
          };

          const [opRes, gdnRes] = await Promise.all([
            supabase.from('opening_stock').upsert(payloadOp),
            supabase.from('godown_wise_stock').upsert(payloadGdn)
          ]);
          
          if (opRes.error) throw opRes.error;
          if (gdnRes.error) throw gdnRes.error;
          success = true;
        } catch (dbErr) {
          console.warn("Database operation failed for opening stock, utilizing local storage fallback:", dbErr);
        }
      }

      if (!success) {
        const stored = localStorage.getItem('po_auto_opening_stock');
        let current: any[] = [];
        if (stored && stored !== 'undefined' && stored !== 'null') {
          try { current = JSON.parse(stored === "undefined" ? "null" : stored); } catch (e) { console.error(e); }
        }
        if (isEditing && formState.id) {
          current = current.map(item => item.id === formState.id ? { ...item, ...payload } : item);
          logOpeningStockAudit('UPDATE', `[Local] Updated Opening Stock: ${finalGrade} @ ${finalGodown}`);
          alert("Opening Stock record updated locally!");
        } else {
          const newRecord = { ...payload, created_at: new Date().toISOString() };
          current = [newRecord, ...current];
          logOpeningStockAudit('CREATE', `[Local] Created Opening Stock: ${finalGrade} @ ${finalGodown}`);
          alert("New Opening Stock master record created locally!");
        }
        localStorage.setItem('po_auto_opening_stock', JSON.stringify(current));
        setOpeningStocks(current);
      } else {
        logOpeningStockAudit(isEditing ? 'UPDATE' : 'CREATE', `${isEditing ? 'Updated' : 'Created'} Opening Stock: ${finalGrade} @ ${finalGodown} [Qty: ${qty} ${finalUnit}, Wt: ${wt} Qtl]`);
        alert(isEditing ? "Opening Stock record updated successfully!" : "New Opening Stock master record created successfully!");
        await loadOpeningStocks();
      }
      setIsFormModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      alert("Error saving record: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClosingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const finalGrade = closingFormState.grade === 'CUSTOM_MANUAL' ? customGradeValueClosing : closingFormState.grade;

    if (!finalGrade || !finalGrade.trim()) {
      alert("Please provide a valid Grade specification.");
      setLoading(false);
      return;
    }

    const payload = {
      stock_date: closingFormState.stock_date,
      godown: closingFormState.godown,
      commodity: closingFormState.commodity,
      variety: closingFormState.variety,
      grade: finalGrade.toUpperCase().trim(),
      no_of_bales: parseInt(closingFormState.no_of_bales) || 0,
      weight_qtl: parseFloat(closingFormState.weight_qtl) || 0,
      rate_per_qtl: parseFloat(closingFormState.rate_per_qtl) || 0,
      total_value: parseFloat(closingFormState.total_value) || 0,
      remarks: closingFormState.remarks,
      recorded_by: closingFormState.recorded_by || 'ADMIN'
    };

    try {
      if (isEditing && closingFormState.id) {
        const { error } = await supabase
          .from('closing_stock')
          .update(payload)
          .eq('id', closingFormState.id);
        
        if (error) throw error;
        logOpeningStockAudit('UPDATE', `Updated Closing Stock: ${finalGrade} @ ${closingFormState.godown} [Bales: ${closingFormState.no_of_bales}, Value: Rs. ${closingFormState.total_value}]`);
        alert("Success: Closing Stock record updated successfully!");
      } else {
        const { error } = await supabase
          .from('closing_stock')
          .insert(payload);
        
        if (error) throw error;
        logOpeningStockAudit('CREATE', `Created Closing Stock: ${finalGrade} @ ${closingFormState.godown} [Bales: ${closingFormState.no_of_bales}, Value: Rs. ${closingFormState.total_value}]`);
        alert("Success: New Monthly Closing Stock master registered!");
      }
      setIsFormModalOpen(false);
      resetClosingForm();
      await loadClosingStocks();
    } catch (dbErr: any) {
      console.warn("DB write failed, fallback to offline local storage", dbErr);
      const current = [...closingStocks];
      if (isEditing && closingFormState.id) {
        const idx = current.findIndex(c => c.id === closingFormState.id);
        if (idx !== -1) {
          current[idx] = { ...payload, id: closingFormState.id };
        }
      } else {
        current.unshift({ ...payload, id: `local-${Date.now()}` });
      }
      setClosingStocks(current);
      alert("Success: Closing Inventory Stock record saved!");
      setIsFormModalOpen(false);
      resetClosingForm();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row: any) => {
    const qty = parseFloat(row.quantity) || 0;
    const wt = parseFloat(row.weight) || 0;
    const computedAvg = qty > 0 ? (wt / qty).toFixed(3) : '0.000';

    setFormState({
      id: row.id,
      opening_date: row.opening_date,
      godown: row.godown,
      area: row.area,
      grade: row.grade,
      jci: row.jci || 'No',
      unit: row.unit || 'BALES',
      quantity: String(row.quantity),
      weight: String(row.weight),
      avg_weight: row.avg_weight ? String(row.avg_weight) : computedAvg,
    });

    setIsEditing(true);
    setIsFormModalOpen(true);
  };

  const handleEditClosing = (row: any) => {
    const gradeExists = mergedGrades.some(g => (g.grade_name || g.name || g.code || '').toUpperCase() === row.grade.toUpperCase());

    setClosingFormState({
      id: row.id,
      stock_date: row.stock_date,
      godown: row.godown,
      commodity: row.commodity || 'RAW JUTE',
      variety: row.variety || 'TOSSA',
      grade: gradeExists ? row.grade : 'CUSTOM_MANUAL',
      no_of_bales: String(row.no_of_bales || 0),
      weight_qtl: String(row.weight_qtl || 0.0),
      rate_per_qtl: String(row.rate_per_qtl || 6500),
      total_value: String(row.total_value || 0.0),
      remarks: row.remarks || '',
      recorded_by: row.recorded_by || 'ADMIN'
    });

    if (!gradeExists) {
      setCustomGradeValueClosing(row.grade);
      setShowCustomGradeClosing(true);
    } else {
      setShowCustomGradeClosing(false);
      setCustomGradeValueClosing('');
    }

    setIsEditing(true);
    setIsFormModalOpen(true);
  };

  const handleDelete = async ( id: string, name: string) => {
    if (!canDeleteData()) {
      alert("Only Admin can delete data.");
      return;
    }

    if (confirm(`Are you sure you want to permanently delete Opening Stock entry for [${name}]?`)) {
      setLoading(true);
      try {
        if (supabase) {
          const [opDel, gdnDel] = await Promise.all([
            supabase.from('opening_stock').delete().eq('id', id),
            supabase.from('godown_wise_stock').delete().eq('id', id)
          ]);
          
          if (opDel.error) throw opDel.error;
          if (gdnDel.error) throw gdnDel.error;
        }

        logOpeningStockAudit('DELETE', `Deleted Opening Stock record [ID: ${id}]: ${name}`);
        alert("Opening Stock record deleted successfully from database.");
        await loadOpeningStocks();

        if (formState.id === id) {
          resetForm();
        }
      } catch (err: any) {
        alert("Deletion failed: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteClosing = async ( id: string, name: string) => {
    if (!canDeleteData()) {
      alert("Only Admin can delete data.");
      return;
    }

    if (confirm(`Are you sure you want to permanently delete Closing Stock entry for [${name}]?`)) {
      setLoading(true);
      try {
        if (supabase) {
          const { error } = await supabase
            .from('closing_stock')
            .delete()
            .eq('id', id);
          if (error) throw error;
        }
        logOpeningStockAudit('DELETE', `Deleted Closing Stock record [ID: ${id}]: ${name}`);
        alert("Closing Stock record deleted successfully from database.");
        await loadClosingStocks();
        if (closingFormState.id === id) {
          resetClosingForm();
        }
      } catch (err: any) {
        console.warn("DB delete failed, pruning in memory", err);
        const updated = closingStocks.filter(c => c.id !== id);
        setClosingStocks(updated);
        alert("Closing Stock record deleted.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Searching & live filters
  const filteredSavedStocks = openingStocks.filter(row => {
    const rowDate = row.opening_date || row.stock_date || '';
    if (startDateFilter && rowDate < startDateFilter) return false;
    if (endDateFilter && rowDate > endDateFilter) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (row.opening_date || '').toLowerCase().includes(q) ||
      (row.godown || '').toLowerCase().includes(q) ||
      (row.area || '').toLowerCase().includes(q) ||
      (row.grade || '').toLowerCase().includes(q) ||
      (row.unit || '').toLowerCase().includes(q) ||
      (row.jci || '').toLowerCase().includes(q)
    );
  });

  const filteredClosingStocks = closingStocks.filter(row => {
    const rowDate = row.stock_date || row.opening_date || '';
    if (startDateFilter && rowDate < startDateFilter) return false;
    if (endDateFilter && rowDate > endDateFilter) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (row.stock_date || '').toLowerCase().includes(q) ||
      (row.godown || '').toLowerCase().includes(q) ||
      (row.commodity || '').toLowerCase().includes(q) ||
      (row.variety || '').toLowerCase().includes(q) ||
      (row.grade || '').toLowerCase().includes(q) ||
      (row.remarks || '').toLowerCase().includes(q)
    );
  });

  const calculateLiveStocks = () => {
    // Standardize grades to merge records correctly
    const gradeMap: { [key: string]: {
      grade: string;
      openingQty: number;
      openingWt: number;
      incomingQty: number;
      incomingWt: number;
      outgoingQty: number;
      outgoingWt: number;
    }} = {};

    // 1. Process opening_stock as initial opening stock components
    openingStocks.forEach(item => {
      const gName = String(item.grade || 'UNKNOWN').trim().toUpperCase();
      if (!gradeMap[gName]) {
        gradeMap[gName] = { grade: gName, openingQty: 0, openingWt: 0, incomingQty: 0, incomingWt: 0, outgoingQty: 0, outgoingWt: 0 };
      }
      gradeMap[gName].openingQty += Number(item.quantity) || 0;
      gradeMap[gName].openingWt += Number(item.weight) || 0;
    });

    // 2. Classify material issue masters by type
    const godownIssueNos = new Set<string>(); // "Issue to Godown" (Incoming)
    const factoryIssueNos = new Set<string>(); // "Godown to Factory" (Outgoing)

    millIssueMasters.forEach(m => {
      const type = String(m.issue_type || '').trim().toUpperCase();
      const issueNoUpper = String(m.issue_no).trim().toUpperCase();
      if (type === 'GODOWN') {
        godownIssueNos.add(issueNoUpper);
      } else if (type === 'FACTORY' || type === 'FACTORY ISSUE' || type === 'SELL') {
        factoryIssueNos.add(issueNoUpper);
      }
    });

    // 3. Process details and map to the correct grade
    millIssueDetails.forEach(d => {
      const issueNoUpper = String(d.issue_no).trim().toUpperCase();
      const gName = String(d.grade_name || d.grade || 'UNKNOWN').trim().toUpperCase();

      if (godownIssueNos.has(issueNoUpper)) {
        if (!gradeMap[gName]) {
          gradeMap[gName] = { grade: gName, openingQty: 0, openingWt: 0, incomingQty: 0, incomingWt: 0, outgoingQty: 0, outgoingWt: 0 };
        }
        gradeMap[gName].incomingQty += Number(d.qty) || 0;
        const wtKgs = Number(d.weight_kgs) || 0;
        gradeMap[gName].incomingWt += wtKgs / 100; // Convert kgs to quintals
      } else if (factoryIssueNos.has(issueNoUpper)) {
        if (!gradeMap[gName]) {
          gradeMap[gName] = { grade: gName, openingQty: 0, openingWt: 0, incomingQty: 0, incomingWt: 0, outgoingQty: 0, outgoingWt: 0 };
        }
        gradeMap[gName].outgoingQty += Number(d.qty) || 0;
        const wtKgs = Number(d.weight_kgs) || 0;
        gradeMap[gName].outgoingWt += wtKgs / 100; // Convert kgs to quintals
      }
    });

    // 4. Return formatted objects with final balances (Opening + Incoming - Outgoing)
    return Object.values(gradeMap).map(row => {
      const balanceQty = row.openingQty + row.incomingQty - row.outgoingQty;
      const balanceWt = row.openingWt + row.incomingWt - row.outgoingWt;

      return {
        grade: row.grade,
        openingQty: row.openingQty,
        openingWt: row.openingWt,
        incomingQty: row.incomingQty,
        incomingWt: row.incomingWt,
        outgoingQty: row.outgoingQty,
        outgoingWt: row.outgoingWt,
        balanceQty,
        balanceWt
      };
    });
  };

  // Format Date gracefully for system and human reading
  const formatDateBeautiful = (dateStr: string) => {
    if (!dateStr || dateStr === 'No Date') return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Dynamic Metrics variables
  let totalOpeningQty = 0;
  let totalOpeningWt = 0;
  let totalIssuedToGodownBales = 0;
  let totalIssuedToGodownWeight = 0;
  let totalIssuedToFactoryBales = 0;
  let totalIssuedToFactoryWeight = 0;

  if (metricCalculationMode === 'cumulative') {
    // Cumulative mode: includes all historical records up to the end limits
    const endLimit = endDateFilter || '9999-12-31';

    // Opening Stock (Baseline) up to the target date
    const opFiltered = openingStocks.filter(r => (r.opening_date || r.stock_date || '') <= endLimit);
    totalOpeningQty = opFiltered.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    totalOpeningWt = opFiltered.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

    // Filter receipts up to the target date
    const godownIssueNosSet = new Set(
      millIssueMasters
        .filter(m => String(m.issue_type || '').trim().toUpperCase() === 'GODOWN' && (m.date || '') <= endLimit)
        .map(m => String(m.issue_no).trim().toUpperCase())
    );
    totalIssuedToGodownBales = millIssueDetails
      .filter(d => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + (Number(d.qty) || 0), 0);
    totalIssuedToGodownWeight = millIssueDetails
      .filter(d => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);

    // Filter factory consumption up to the target date
    const factoryIssueNosSet = new Set(
      millIssueMasters
        .filter(m => {
          const type = String(m.issue_type || '').trim().toUpperCase();
          const isFactoryType = type === 'FACTORY' || type === 'FACTORY ISSUE' || type === 'SELL';
          return isFactoryType && (m.date || '') <= endLimit;
        })
        .map(m => String(m.issue_no).trim().toUpperCase())
    );
    totalIssuedToFactoryBales = millIssueDetails
      .filter(d => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + (Number(d.qty) || 0), 0);
    totalIssuedToFactoryWeight = millIssueDetails
      .filter(d => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);

  } else {
    // Period Activity Mode: Strictly within the selected date filters
    const startLimit = startDateFilter || '1900-01-01';
    const endLimit = endDateFilter || '9999-12-31';

    // Opening Stock registered inside the selected period
    const opFiltered = openingStocks.filter(r => {
      const d = r.opening_date || r.stock_date || '';
      return d >= startLimit && d <= endLimit;
    });
    totalOpeningQty = opFiltered.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    totalOpeningWt = opFiltered.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

    // Receipts registered within the selected period
    const godownIssueNosSet = new Set(
      millIssueMasters
        .filter(m => {
          const type = String(m.issue_type || '').trim().toUpperCase();
          const d = m.date || '';
          return type === 'GODOWN' && d >= startLimit && d <= endLimit;
        })
        .map(m => String(m.issue_no).trim().toUpperCase())
    );
    totalIssuedToGodownBales = millIssueDetails
      .filter(d => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + (Number(d.qty) || 0), 0);
    totalIssuedToGodownWeight = millIssueDetails
      .filter(d => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);

    // Consumption registered within the selected period
    const factoryIssueNosSet = new Set(
      millIssueMasters
        .filter(m => {
          const type = String(m.issue_type || '').trim().toUpperCase();
          const d = m.date || '';
          const isFactoryType = type === 'FACTORY' || type === 'FACTORY ISSUE' || type === 'SELL';
          return isFactoryType && d >= startLimit && d <= endLimit;
        })
        .map(m => String(m.issue_no).trim().toUpperCase())
    );
    totalIssuedToFactoryBales = millIssueDetails
      .filter(d => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + (Number(d.qty) || 0), 0);
    totalIssuedToFactoryWeight = millIssueDetails
      .filter(d => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum, d) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);
  }

  // Current Stock Balance = Opening + In - Out
  const currentClosingStockBales = totalOpeningQty + totalIssuedToGodownBales - totalIssuedToFactoryBales;
  const currentClosingStockWeight = totalOpeningWt + totalIssuedToGodownWeight - totalIssuedToFactoryWeight;

  // Compute detailed dynamic period captions for tooltips/badges
  const getOpeningStockDateInfo = () => {
    if (startDateFilter || endDateFilter) {
      if (metricCalculationMode === 'cumulative') {
        return `OPENING STOCK AS OF ${formatDateBeautiful(endDateFilter || 'LATEST')}`;
      } else {
        return `OPENINGS FROM ${formatDateBeautiful(startDateFilter || 'EARLIEST')} TO ${formatDateBeautiful(endDateFilter || 'LATEST')}`;
      }
    }
    const dates = openingStocks.map(r => r.opening_date || r.stock_date).filter(Boolean).sort();
    if (dates.length === 0) return 'NO BASELINE RECORDED';
    if (dates.length === 1) return `AS OF ${formatDateBeautiful(dates[0])}`;
    return `BASE: ${formatDateBeautiful(dates[0])} TO ${formatDateBeautiful(dates[dates.length - 1])}`;
  };

  const getIssuedToGodownDateInfo = () => {
    const startLimit = startDateFilter || '1900-01-01';
    const endLimit = endDateFilter || '9999-12-31';

    const dates = millIssueMasters
      .filter(m => {
        const type = String(m.issue_type || '').trim().toUpperCase();
        if (type !== 'GODOWN') return false;
        if (metricCalculationMode === 'cumulative') {
          return (m.date || '') <= endLimit;
        } else {
          return (m.date || '') >= startLimit && (m.date || '') <= endLimit;
        }
      })
      .map(m => m.date)
      .filter(Boolean)
      .sort();

    if (dates.length === 0) return 'NO INWARDS RECORDED';
    return metricCalculationMode === 'cumulative'
      ? `TOTAL INWARDS UP TO ${formatDateBeautiful(dates[dates.length - 1])}`
      : `INWARDS: ${formatDateBeautiful(dates[0])} TO ${formatDateBeautiful(dates[dates.length - 1])}`;
  };

  const getIssuedToFactoryDateInfo = () => {
    const startLimit = startDateFilter || '1900-01-01';
    const endLimit = endDateFilter || '9999-12-31';

    const dates = millIssueMasters
      .filter(m => {
        const type = String(m.issue_type || '').trim().toUpperCase();
        const matches = type === 'FACTORY' || type === 'FACTORY ISSUE' || type === 'SELL';
        if (!matches) return false;
        if (metricCalculationMode === 'cumulative') {
          return (m.date || '') <= endLimit;
        } else {
          return (m.date || '') >= startLimit && (m.date || '') <= endLimit;
        }
      })
      .map(m => m.date)
      .filter(Boolean)
      .sort();

    if (dates.length === 0) return 'NO OUTWARDS RECORDED';
    return metricCalculationMode === 'cumulative'
      ? `TOTAL OUTWARDS UP TO ${formatDateBeautiful(dates[dates.length - 1])}`
      : `OUTWARDS: ${formatDateBeautiful(dates[0])} TO ${formatDateBeautiful(dates[dates.length - 1])}`;
  };

  const getCurrentStockBalanceDateInfo = () => {
    const endLimit = endDateFilter || '9999-12-31';
    if (startDateFilter || endDateFilter) {
      if (metricCalculationMode === 'cumulative') {
        return `STOCK POSITION AS OF ${formatDateBeautiful(endLimit)}`;
      } else {
        return `NET CHANGE IN SELECTED PERIOD`;
      }
    }
    const allDates: string[] = [];
    openingStocks.forEach(r => { if (r.opening_date || r.stock_date) allDates.push(r.opening_date || r.stock_date); });
    millIssueMasters.forEach(r => { if (r.date) allDates.push(r.date); });
    if (allDates.length === 0) return 'NO DATA AS OF NOW';
    allDates.sort();
    return `REAL-TIME AS OF: ${formatDateBeautiful(allDates[allDates.length - 1])}`;
  };

  // Calculate closing sums from closingStocks (for Monthly tab)
  const totalClosingBales = filteredClosingStocks.reduce((sum, r) => sum + (Number(r.no_of_bales) || 0), 0);
  const totalClosingWt = filteredClosingStocks.reduce((sum, r) => sum + (Number(r.weight_qtl) || 0), 0);
  const totalClosingValue = filteredClosingStocks.reduce((sum, r) => sum + (Number(r.total_value) || 0), 0);

  // Group by Date for the "Date Wise Total Opening Stock Report"
  const dateWiseOpeningStocksMap: { [date: string]: { count: number; quantity: number; weight: number } } = {};
  openingStocks.forEach(r => {
    const d = r.opening_date || r.stock_date || 'No Date';
    if (!dateWiseOpeningStocksMap[d]) {
      dateWiseOpeningStocksMap[d] = { count: 0, quantity: 0, weight: 0 };
    }
    dateWiseOpeningStocksMap[d].count += 1;
    dateWiseOpeningStocksMap[d].quantity += Number(r.quantity || 0);
    dateWiseOpeningStocksMap[d].weight += Number(r.weight || 0);
  });

  const dateWiseOpeningList = Object.entries(dateWiseOpeningStocksMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Group by Date for the "Date Wise Total Monthly Stock Report"
  const dateWiseClosingStocksMap: { [date: string]: { count: number; quantity: number; weight: number; value: number } } = {};
  closingStocks.forEach(r => {
    const d = r.stock_date || r.opening_date || 'No Date';
    if (!dateWiseClosingStocksMap[d]) {
      dateWiseClosingStocksMap[d] = { count: 0, quantity: 0, weight: 0, value: 0 };
    }
    dateWiseClosingStocksMap[d].count += 1;
    dateWiseClosingStocksMap[d].quantity += Number(r.no_of_bales || 0);
    dateWiseClosingStocksMap[d].weight += Number(r.weight_qtl || 0);
    dateWiseClosingStocksMap[d].value += Number(r.total_value || 0);
  });

  const dateWiseClosingList = Object.entries(dateWiseClosingStocksMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <LegacyLayout title="Inventory" subtitle="" onClose={onClose}>
      <div className="space-y-4">
        {/* Global Counters Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <StockMetric 
             label="Total Opening Stock" 
             bales={totalOpeningQty} 
             weight={totalOpeningWt} 
             type="bales" 
             subText={getOpeningStockDateInfo()}
           />
           <StockMetric 
             label="Issued to Godown (+)" 
             bales={totalIssuedToGodownBales} 
             weight={totalIssuedToGodownWeight} 
             type="sold" 
             subText={getIssuedToGodownDateInfo()}
           />
           <StockMetric 
             label="Godown to Factory (-)" 
             bales={totalIssuedToFactoryBales} 
             weight={totalIssuedToFactoryWeight} 
             type="weight" 
             subText={getIssuedToFactoryDateInfo()}
           />
           <StockMetric 
             label="Current Stock Balance" 
             bales={currentClosingStockBales} 
             weight={currentClosingStockWeight} 
             type="stock" 
             subText={getCurrentStockBalanceDateInfo()}
           />
        </div>

        {/* Windows Classic Tab Selectors & Integrated Period Controls */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center border-b border-[#808080]/65 bg-[#d4d0c8] p-1 gap-2 ">
          <div className="flex gap-1">
            <button 
              onClick={() => setActiveTab('opening')}
              className={cn(
                "px-4 py-1.5 text-xs font-black uppercase tracking-tight transition-all cursor-pointer border-2 border-white",
                activeTab === 'opening' 
                  ? "bg-white text-indigo-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)] translate-y-px" 
                  : "bg-legacy-bg text-gray-700 hover:bg-white/50"
              )}
            >
              📋 Stock Inventory Ledgers
            </button>
            <button 
              onClick={() => setActiveTab('live')}
              className={cn(
                "px-4 py-1.5 text-xs font-black uppercase tracking-tight transition-all cursor-pointer border-2 border-white",
                activeTab === 'live' 
                  ? "bg-white text-indigo-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)] translate-y-px" 
                  : "bg-legacy-bg text-gray-700 hover:bg-white/50"
              )}
            >
              📉 Live Inventory Valuation
            </button>
          </div>

          {/* Integrated Stock Period & Mode selectors (Placed dynamically in screenshot 2 area) */}
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto bg-white/40 p-1 border border-white/60 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.05)] rounded-sm">
            <span className="text-[9px] font-black uppercase text-indigo-950 px-1 border-r border-gray-400">
              📅 Stock Period:
            </span>
            <span className="text-[9px] font-bold text-gray-700">
              {startDateFilter || endDateFilter ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  <span className="font-mono font-black text-red-700 bg-white px-1 border border-gray-300">
                    {startDateFilter ? formatDateBeautiful(startDateFilter) : 'Start'} to {endDateFilter ? formatDateBeautiful(endDateFilter) : 'End'}
                  </span>
                  <button
                    onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                    className="text-[8px] font-black text-red-700 border border-red-400 hover:bg-red-50 bg-white px-1.5 py-0.2 shadow-xs cursor-pointer uppercase tracking-tight"
                    title="Clear date filter"
                  >
                    Reset
                  </button>
                </span>
              ) : (
                <span className="text-gray-500 font-mono font-bold bg-white/60 px-1 border border-gray-300">
                  ALL HISTORY (LATEST)
                </span>
              )}
            </span>

            <span className="text-[9px] font-black uppercase text-indigo-950 px-1 border-l border-gray-300 border-r border-gray-400">
              Calculation Mode:
            </span>
            <div className="inline-flex rounded border border-gray-400 p-0.5 bg-white">
              <button
                onClick={() => setMetricCalculationMode('cumulative')}
                className={cn(
                  "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tight transition-all cursor-pointer",
                  metricCalculationMode === 'cumulative'
                    ? "bg-indigo-950 text-white rounded-xs"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                title="True cumulative stock balance as of end period"
              >
                📈 As-Of
              </button>
              <button
                onClick={() => setMetricCalculationMode('period')}
                className={cn(
                  "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tight transition-all cursor-pointer",
                  metricCalculationMode === 'period'
                    ? "bg-indigo-950 text-white rounded-xs"
                    : "text-gray-600 hover:bg-gray-100"
                )}
                title="Only activity/transactions occurred inside selected period"
              >
                📊 Period Activity
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'opening' ? (
          /* Tab 1: Latest Stock Ledgers (Opening / Closing Switcher without cramped sidebar) */
          <div className="space-y-3">
            
            {/* Windows 95 Retro Style Sub-Tabs Switcher */}
            <div className="flex border-b border-[#808080]/30 bg-[#d4d0c8] p-1 gap-1.5 ">
              <button 
                onClick={() => setStockSubTab('opening')}
                className={cn(
                  "px-3.5 py-1 text-[11px] font-black uppercase tracking-tight transition-all cursor-pointer border-2",
                  stockSubTab === 'opening' 
                    ? "bg-white border-white text-indigo-950 font-black shadow-[1px_1px_0_0_black]" 
                    : "bg-[#d4d0c8] border-[#d4d0c8] text-gray-600 hover:bg-[#c0c0c0]"
                )}
              >
                📦 Godown Wise Stock Entry (Opening)
              </button>
              <button 
                onClick={() => setStockSubTab('closing')}
                className={cn(
                  "px-3.5 py-1 text-[11px] font-black uppercase tracking-tight transition-all cursor-pointer border-2",
                  stockSubTab === 'closing' 
                    ? "bg-white border-white text-indigo-950 font-black shadow-[1px_1px_0_0_black]" 
                    : "bg-[#d4d0c8] border-[#d4d0c8] text-gray-600 hover:bg-[#c0c0c0]"
                )}
              >
                🔴 Monthly Opening Stock Ledger
              </button>
            </div>
            
            {/* Action options (2nd Screenshot Options) */}
            <>
              <div className="flex gap-1.5 items-center flex-wrap  bg-[#c0c0c0] p-1 border border-black/20 shadow-sm">
                  <button
                    onClick={() => {
                      if (stockSubTab === 'opening') {
                        resetForm();
                      } else {
                        resetClosingForm();
                      }
                      setIsEditing(false);
                      setIsFormModalOpen(true);
                    }}
                    className="bg-[#000080] hover:bg-blue-800 text-white shadow-[1px_1px_0_0_black] px-4 text-[10px] uppercase font-black tracking-wide h-6 flex items-center gap-1.5 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {stockSubTab === 'opening' ? 'New Opening Record' : 'New Monthly Record'}
                  </button>
                  <button 
                    onClick={handleExportToCSV} 
                    className="bg-[#24a148] hover:bg-[#1e853c] text-white shadow-[1px_1px_0_0_black] px-3.5 text-[10px] uppercase font-black tracking-wide h-6 flex items-center gap-1.5 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] transition-colors cursor-pointer"
                    title="Download active ledger records as CSV format"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-100" /> Export to CSV
                  </button>
                  <button
                    onClick={() => {
                      if (stockSubTab === 'opening') {
                        if (selectedStockId) {
                          const target = openingStocks.find(s => s.id === selectedStockId);
                          if (target) handlePreparePrint(target);
                        } else {
                          alert("Please select an Opening Stock row first.");
                        }
                      } else {
                        if (selectedClosingStockId) {
                          const target = closingStocks.find(s => s.id === selectedClosingStockId);
                          if (target) handlePrepareClosingPrint(target);
                        } else {
                          alert("Please select a Opening Stock row first.");
                        }
                      }
                    }}
                    className="bg-[#d4d0c8] hover:bg-white text-slate-900 border border-black/25 shadow-[1px_1px_0_0_black] px-3.5 text-[10px] uppercase font-black tracking-wide h-6 flex items-center gap-1.5 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Selected Slip
                  </button>
                  
                </div>

                {/* Dynamic Search & Reloader Panel */}
                <div className="flex bg-[#c0c0c0] p-1 border border-black/20 gap-2 items-center">
                  <div className="flex bg-white border border-gray-400 p-px flex-1">
                    <div className="bg-gray-100 flex items-center px-1.5 border-r border-gray-300">
                      <Search className="h-3.5 w-3.5 text-gray-500" />
                    </div>
                    <input  id="searchquery_1518" name="searchquery" aria-label="searchquery"
                      className="flex-1 text-xs px-2 py-1 outline-none font-bold" 
                      placeholder={stockSubTab === 'opening' 
                        ? "Search opening ledger latest stock (e.g. Forbesganj, TD-5, Godown)..." 
                        : "Search monthly closing ledger latest stock (e.g. Rate, Bales, Variety, Remarks)..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-[10px] uppercase font-black text-red-700 px-2 hover:bg-slate-50 border-l border-gray-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 h-full font-bold">
                    <LegacyButton 
                      icon={RefreshCw} 
                      label="Re-load" 
                      onClick={stockSubTab === 'opening' ? loadOpeningStocks : loadClosingStocks} 
                    />
                  </div>
                </div>
              </>

            {/* 15.1 Opening Stocks Ledger Grid layout */}
            {stockSubTab === 'opening' ? (() => {
              const gwtTotalQty = filteredSavedStocks.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
              const gwtTotalWeight = filteredSavedStocks.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
              const distinctGodowns = Array.from(new Set(filteredSavedStocks.map(r => String(r.godown || '').trim().toUpperCase()).filter(Boolean)));
              const gwtDistinctGodownsCount = distinctGodowns.length;
              const gwtOverallAvgWt = gwtTotalQty > 0 ? Number((gwtTotalWeight / gwtTotalQty).toFixed(4)) : 0;

              const activeGdnCapacityMT = distinctGodowns.reduce((acc, name) => {
                const info = getGodownCapacityAndName(name);
                return acc + info.capacity;
              }, 0);

              const activeGodownData = distinctGodowns.map(name => {
                const info = getGodownCapacityAndName(name);
                const records = filteredSavedStocks.filter(r => String(r.godown || '').trim().toUpperCase() === name);
                const weight = records.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
                const qty = records.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
                const utilPercent = info.capacity > 0 ? (weight / info.capacity) * 100 : 0;
                return {
                  name,
                  capacity: info.capacity,
                  storedWeight: weight,
                  storedQty: qty,
                  utilPercent: Math.min(100, utilPercent),
                  rawUtil: utilPercent
                };
              });

              return (
                <div className="space-y-4">
                  
                  {/* METRICS ROW */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-100">
                    {/* Total Quantity */}
                    <div className="bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 p-4 rounded-xl flex items-center justify-between shadow-xs transition-all ">
                      <div className="space-y-1 text-left">
                        <span className="text-[10px] font-black uppercase text-indigo-950/70 tracking-wider block">Total Bales Entry</span>
                        <p className="text-2xl font-black font-mono text-indigo-950 tracking-tight leading-none">
                          {gwtTotalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </p>
                        <span className="text-[8px] font-black text-slate-400 block uppercase">Across active openings</span>
                      </div>
                      <div className="p-3 bg-indigo-50 text-indigo-950 rounded-lg">
                        <Box className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Total Weight */}
                    <div className="bg-white border-2 border-dashed border-teal-200 hover:border-teal-400 p-4 rounded-xl flex items-center justify-between shadow-xs transition-all ">
                      <div className="space-y-1 text-left">
                        <span className="text-[10px] font-black uppercase text-teal-950/70 tracking-wider block">Total Book Weight</span>
                        <p className="text-2xl font-black font-mono text-teal-800 tracking-tight leading-none">
                          {(gwtTotalWeight / 10).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                        </p>
                        <span className="text-[8px] font-black text-teal-600 block uppercase">MT</span>
                      </div>
                      <div className="p-3 bg-teal-50 text-teal-700 rounded-lg">
                        <Layers className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Active Godowns */}
                    <div className="bg-white border-2 border-dashed border-amber-200 hover:border-amber-400 p-4 rounded-xl flex items-center justify-between shadow-xs transition-all ">
                      <div className="space-y-1 text-left">
                        <span className="text-[10px] font-black uppercase text-amber-950/70 tracking-wider block">Active Godowns</span>
                        <p className="text-2xl font-black font-mono text-amber-900 tracking-tight leading-none">
                          {gwtDistinctGodownsCount}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowCapacityPopup(true)}
                          className="text-[8px] font-black text-sky-700 hover:text-sky-900 hover:underline block uppercase text-left cursor-pointer"
                        >
                          Verify Godown Capacity ↗
                        </button>
                      </div>
                      <div className="p-3 bg-amber-50 text-amber-700 rounded-lg">
                        <MapPin className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Average Weight per Bale */}
                    <div className="bg-white border-2 border-dashed border-emerald-200 hover:border-emerald-400 p-4 rounded-xl flex items-center justify-between shadow-xs transition-all ">
                      <div className="space-y-1 text-left">
                        <span className="text-[10px] font-black uppercase text-emerald-950/70 tracking-wider block">Avg Wt / Bale</span>
                        <p className="text-2xl font-black font-mono text-emerald-800 tracking-tight leading-none">
                          {(gwtOverallAvgWt / 10).toFixed(4)}
                        </p>
                        <span className="text-[8px] font-black text-emerald-600 block uppercase">MT / unit ratio</span>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
                        <Percent className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  {/* CHARTS ROW */}
                  {filteredSavedStocks.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-in fade-in duration-150">
                      {/* Left Column: Grade-Wise Stock Distribution */}
                      <div className="lg:col-span-8 bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
                        <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-indigo-950 flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-emerald-700 animate-pulse" />
                            Grade-Wise Stock Distribution
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1 justify-start">
                          {Object.values(
                            filteredSavedStocks.reduce((acc: { [key: string]: { grade: string, qty: number } }, r) => {
                              const g = r.grade || "Unknown";
                              if (!acc[g]) acc[g] = { grade: g, qty: 0 };
                              acc[g].qty += Number(r.quantity || 0);
                              return acc;
                            }, {})
                          ).map((itm: any) => (
                            <div key={itm.grade} className="border border-slate-200 bg-slate-50 p-2 text-center rounded-lg min-w-[70px]  hover:bg-slate-100/50 transition-colors">
                              <p className="text-[9px] font-black uppercase text-slate-800 leading-none mb-1">{itm.grade}</p>
                              <p className="text-[8.5px] font-bold text-slate-500 font-mono">{itm.qty} Bales</p>
                            </div>
                          ))}
                        </div>

                        <div className="h-[210px] w-full pt-4 font-mono text-[9px]">
                          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <BarChart
                              layout="vertical"
                              data={Object.values(
                                filteredSavedStocks.reduce((acc: { [key: string]: { grade: string, qty: number, wt: number } }, r) => {
                                  const name = r.grade || "Unknown";
                                  if (!acc[name]) acc[name] = { grade: name, qty: 0, wt: 0 };
                                  acc[name].qty += Number(r.quantity || 0);
                                  acc[name].wt += Number(r.weight || 0) / 10;
                                  return acc;
                                }, {})
                              )}
                              margin={{ top: 5, right: 15, left: -5, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                              <XAxis type="number" stroke="#475569" fontSize={9} />
                              <YAxis dataKey="grade" type="category" stroke="#475569" fontSize={9} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: "#1e293b", color: "#f8fafc", fontSize: "9px", fontFamily: "monospace", border: "1px solid #334155" }}
                              />
                              <Legend wrapperStyle={{ fontSize: "9px" }} />
                              <Bar name="Quantity (bales)" dataKey="qty" fill="#008080" radius={[0, 3, 3, 0]} />
                              <Bar name="Net weight (MT)" dataKey="wt" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Right Column: Calculations & Capacity Share */}
                      <div className="lg:col-span-4 space-y-4 text-left">
                        {/* Weighted calculations card */}
                        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
                          <div className="border-b border-slate-100 pb-2 flex items-center gap-1">
                            <ClipboardList className="h-4 w-4 text-[#008080]" />
                            <span className="text-[10px] font-black uppercase text-indigo-950">Weighted Summary</span>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-[8px] text-slate-500 uppercase font-black mb-1">
                                <span>Storage Utilisation (Active GDNs)</span>
                                <span className="font-mono text-indigo-950 font-black">
                                  {activeGdnCapacityMT > 0 ? (((gwtTotalWeight / 10) / activeGdnCapacityMT) * 100).toFixed(1) : "0.0"}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-105 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-[#008080] h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, activeGdnCapacityMT > 0 ? ((gwtTotalWeight / 10) / activeGdnCapacityMT) * 100 : 0)}%` }}
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[8px] text-slate-500 uppercase font-black mb-1">
                                <span>Tossa & TD Grade Ratio</span>
                                <span className="font-mono text-indigo-950 font-black">
                                  {gwtTotalQty > 0 
                                    ? ((filteredSavedStocks.filter(r => (r.grade || '').toUpperCase().includes('TD')).reduce((acc, c) => acc + Number(c.quantity), 0) / gwtTotalQty) * 100).toFixed(1)
                                    : "0.0"}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-101 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-[#4f46e5] h-full rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${gwtTotalQty > 0 
                                      ? (filteredSavedStocks.filter(r => (r.grade || '').toUpperCase().includes('TD')).reduce((acc, c) => acc + Number(c.quantity), 0) / gwtTotalQty) * 100
                                      : 0}%` 
                                  }}
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[8px] text-slate-500 uppercase font-black mb-1">
                                <span>JCI block entries</span>
                                <span className="font-mono text-indigo-950 font-black">
                                  {filteredSavedStocks.length > 0 
                                    ? ((filteredSavedStocks.filter(r => (r.jci || '').toUpperCase().trim() === 'YES' || (r.jci || '').toLowerCase().trim() === 'yes').length / filteredSavedStocks.length) * 100).toFixed(1)
                                    : "0.0"}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-101 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-[#64748b] h-full rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${filteredSavedStocks.length > 0 
                                      ? (filteredSavedStocks.filter(r => (r.jci || '').toUpperCase().trim() === 'YES' || (r.jci || '').toLowerCase().trim() === 'yes').length / filteredSavedStocks.length) * 100
                                      : 0}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Godown Wise Capacity Share (Donut Chart - only if entries present) */}
                        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-4">
                          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-indigo-950 flex items-center gap-1.5">
                              <Sparkles className="h-4 w-4 text-emerald-800" />
                              Godown Capacity Share
                            </span>
                          </div>

                          {gwtTotalWeight > 0 ? (
                            <div className="space-y-3 pt-0.5 animate-in fade-in duration-200">
                              <div className="flex items-center gap-2">
                                <div className="h-[105px] w-[105px] shrink-0 relative">
                                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                    <PieChart>
                                      <Pie
                                        data={[
                                          { name: 'Used', value: gwtTotalWeight / 10 },
                                          { name: 'Free', value: Math.max(0, activeGdnCapacityMT - gwtTotalWeight / 10) }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={32}
                                        outerRadius={45}
                                        paddingAngle={2}
                                        dataKey="value"
                                      >
                                        <Cell fill="#008080" />
                                        <Cell fill="#e2e8f0" />
                                      </Pie>
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[10px] font-extrabold text-teal-800">
                                      {activeGdnCapacityMT > 0 ? (((gwtTotalWeight / 10) / activeGdnCapacityMT) * 100).toFixed(1) : "0.0"}%
                                    </span>
                                    <span className="text-[7px] text-gray-400 font-extrabold uppercase tracking-tighter">used</span>
                                  </div>
                                </div>

                                <div className="flex-1 space-y-1.5 text-[9px] font-extrabold text-[#1e293b] leading-tight">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-block w-2.5 h-2.5 bg-[#008080] rounded-full" />
                                    <span>Used: {(gwtTotalWeight / 10).toFixed(2)} MT ({activeGdnCapacityMT > 0 ? (((gwtTotalWeight / 10) / activeGdnCapacityMT) * 100).toFixed(1) : "0.0"}%)</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-block w-2.5 h-2.5 bg-slate-200 rounded-full" />
                                    <span>Free: {Math.max(0, activeGdnCapacityMT - gwtTotalWeight / 10).toFixed(2)} MT ({activeGdnCapacityMT > 0 ? ((Math.max(0, activeGdnCapacityMT - gwtTotalWeight / 10) / activeGdnCapacityMT) * 100).toFixed(1) : "0.0"}%)</span>
                                  </div>
                                </div>
                              </div>

                              {/* Active godown capacity breakdowns */}
                              <div className="pt-2 border-t border-slate-100 space-y-2 text-[8.5px] uppercase text-slate-500 font-sans">
                                <span className="font-extrabold block text-slate-400 mb-0.5 text-left">Active godown allocation:</span>
                                <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                                  {activeGodownData.map((g, idx) => (
                                    <div key={idx} className="flex flex-col pl-1.5 border-l-2 border-teal-600 py-1 font-sans text-[9px] text-slate-700 space-y-0.5">
                                      <div className="flex justify-between items-center">
                                        <span className="font-extrabold uppercase text-slate-800 truncate max-w-[125px]">Godown {g.name}</span>
                                        <span className="font-mono text-indigo-950 font-black">{g.storedWeight.toFixed(2)} MT</span>
                                      </div>
                                      <div className="flex justify-between text-[8px] text-slate-400">
                                        <span>Master Capacity: {g.capacity} MT</span>
                                        <span className="text-teal-700 font-extrabold">({g.utilPercent.toFixed(1)}% Utilized)</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="py-6 text-center text-slate-400 italic">
                              No stored weight logged to show Godown capacity sharing.
                            </div>
                          )}
                        </div>

                        {/* Date Wise Total Opening Stock Report (Global Summary) */}
                        <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-3 shadow-xs space-y-2 flex flex-col">
                          <div className="border-b border-gray-400 pb-1 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-indigo-950 flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-red-700 animate-pulse" />
                              Date Wise Opening Stock Report
                            </span>
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-500 bg-white/50 px-1 border border-gray-300">Latest Days</span>
                          </div>

                          <div className="bg-white border border-gray-400 h-[120px] overflow-y-auto">
                            <table className="w-full text-left text-[9px] border-collapse font-mono">
                              <thead>
                                <tr className="bg-gray-100 border-b border-gray-300 sticky top-0 font-bold text-gray-600 ">
                                  <th className="px-2 py-0.5 border-r border-gray-200">Stock Date</th>
                                  <th className="px-2 py-0.5 text-center border-r border-gray-200">Entries</th>
                                  <th className="px-2 py-0.5 text-right border-r border-gray-200">Total Qty (Bales)</th>
                                  <th className="px-2 py-0.5 text-right font-black">Weight (MT)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {dateWiseOpeningList.map((rep) => {
                                  const isSelectedDate = startDateFilter === rep.date && endDateFilter === rep.date;
                                  return (
                                    <tr 
                                      key={rep.date} 
                                      className="hover:bg-blue-50 cursor-pointer"
                                      onClick={() => { setStartDateFilter(rep.date); setEndDateFilter(rep.date); }}
                                    >
                                      <td className="px-2 py-0.5 font-bold text-gray-700 flex items-center gap-1">
                                        <span className={cn("w-1.5 h-1.5 rounded-full bg-blue-600 inline-block", isSelectedDate && "bg-red-600 animate-pulse")} />
                                        {new Date(rep.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </td>
                                      <td className="px-2 py-0.5 text-center font-black text-slate-800">{rep.count} nodes</td>
                                      <td className="px-2 py-0.5 text-right font-black text-blue-750">{rep.quantity.toLocaleString(undefined, {maximumFractionDigits: 1})}</td>
                                      <td className="px-2 py-0.5 text-right font-black text-emerald-850">{(rep.weight / 10).toFixed(2)} MT</td>
                                    </tr>
                                  );
                                })}
                                {dateWiseOpeningList.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="text-center py-4 text-gray-400 uppercase font-bold text-[9px]">No opening calendar data loaded.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          
                          <div className="flex justify-between items-center mt-1 text-[8px] text-gray-500 font-bold  leading-normal">
                            <span>* Click on any date row to immediately load that day's records.</span>
                            {(startDateFilter || endDateFilter) && (
                              <button 
                                onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                                className="text-red-700 font-extrabold border border-red-300 hover:bg-red-50 px-1 bg-white cursor-pointer"
                              >
                                Clear Filter
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* TABLE CONTAINER */}
                  <div className="border border-gray-400 bg-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)] overflow-x-auto min-h-[300px]">
                  <table className="w-full border-collapse text-[10px]">
                    <thead className="bg-[#c0c0c0] font-black italic">
                      <tr className="border-b border-gray-400 h-8 text-slate-800 uppercase text-left  text-[9px] tracking-tight">
                        <th className="px-3 border-r border-slate-350 w-24">Date</th>
                        <th className="px-3 border-r border-slate-350 min-w-[150px]">Godown / Warehouse</th>
                        <th className="px-3 border-r border-slate-350">Area Station</th>
                        <th className="px-3 border-r border-slate-350">Grade Component</th>
                        <th className="px-2 border-r border-slate-350 text-center">JCI</th>
                        <th className="px-2 border-r border-slate-350 text-center">Unit</th>
                        <th className="px-3 border-r border-slate-350 text-right">Quantity</th>
                        <th className="px-3 border-r border-slate-350 text-right font-black">Weight (MT)</th>
                        <th className="px-3 border-r border-slate-350 text-right font-black">Avg Wt</th>
                        <th className="px-2 text-center w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-250 font-bold text-slate-900">
                      {filteredSavedStocks.length > 0 ? (
                        filteredSavedStocks.map((row, i) => {
                          const isSelected = selectedStockId === row.id;
                          return (
                            <tr 
                              key={row.id || i}
                              onClick={() => setSelectedStockId(row.id || null)}
                              onDoubleClick={() => handleEdit(row)}
                              className={cn(
                                "h-8 border-b border-gray-100 cursor-pointer hover:bg-[#ffffd0]/60 transition-colors",
                                isSelected ? "bg-[#0a246a] text-white" : (i % 2 === 0 ? "bg-white" : "bg-gray-50/40")
                              )}
                            >
                              <td className={cn("px-3 border-r border-slate-100 font-mono", isSelected ? "text-slate-100 font-extrabold" : "text-stone-600")}>{row.opening_date}</td>
                              <td className={cn("px-3 border-r border-slate-100 font-extrabold uppercase truncate max-w-[180px]", isSelected ? "text-yellow-300" : "text-blue-900")} title={row.godown}>{row.godown || "-"}</td>
                              <td className={cn("px-3 border-r border-slate-100 uppercase", isSelected ? "text-indigo-100" : "text-stone-700")}>{row.area || "-"}</td>
                              <td className={cn("px-3 border-r border-slate-100 uppercase font-extrabold", isSelected ? "text-yellow-250" : "text-slate-750")}>{row.grade || "-"}</td>
                              <td className="px-2 border-r border-slate-100 text-center">
                                {row.jci === 'Yes' ? (
                                  <span className={cn("border px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-widest", isSelected ? "bg-teal-900 text-teal-100 border-teal-500" : "bg-teal-100 text-teal-800 border-teal-200")}>Govt</span>
                                ) : (
                                  <span className={cn("border px-1 py-0.2 rounded text-[8px] uppercase font-bold", isSelected ? "bg-slate-700 text-slate-350 border-slate-650" : "bg-gray-150/10 text-slate-500 border-slate-200")}>No</span>
                                )}
                              </td>
                              <td className={cn("px-2 border-r border-slate-100 text-center font-black", isSelected ? "text-teal-200" : "text-slate-650")}>{row.unit || "BALES"}</td>
                              <td className={cn("px-3 border-r border-slate-100 text-right font-mono text-xs font-black", isSelected ? "text-white" : "text-indigo-950")}>{Number(row.quantity).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 3})}</td>
                              <td className={cn("px-3 border-r border-slate-100 text-right font-mono text-xs font-black", isSelected ? "text-green-300" : "text-emerald-850")}>{(Number(row.weight) / 10).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3})}</td>
                              <td className={cn("px-3 border-r border-slate-100 text-right font-mono text-xs font-bold", isSelected ? "text-yellow-250" : "text-indigo-800")}>
                                {row.avg_weight ? (Number(row.avg_weight) / 10).toFixed(4) : (Number(row.quantity) > 0 ? ((Number(row.weight) / Number(row.quantity)) / 10).toFixed(4) : '0.0000')}
                              </td>
                              <td className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-center items-center gap-1.5">
                                  <button
                                    onClick={() => handleEdit(row)}
                                    title="Edit Opening Record"
                                    className={cn(
                                      "p-1 hover:bg-black/15 rounded transition-all cursor-pointer border border-transparent",
                                      isSelected ? "text-blue-200 hover:text-white" : "text-blue-700 hover:border-blue-200"
                                    )}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(row.id, `${row.grade} @ ${row.godown}`)}
                                    title="Delete Opening Record"
                                    className={cn(
                                      "p-1 hover:bg-black/15 rounded transition-all cursor-pointer border border-transparent",
                                      isSelected ? "text-red-300 hover:text-white" : "text-rose-700 hover:border-rose-200"
                                    )}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-20 text-center font-bold text-gray-400 uppercase italic tracking-wider">
                            {loading ? "Synchronizing ledger node databases..." : "No Opening Stock master rows reported."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Opening Summary stats bar */}
                <div className="bg-[#808080] p-1 flex justify-between gap-1 items-center border border-black/10 ">
                  <div className="flex gap-2 flex-wrap pb-0.5">
                    <div className="bg-white px-3 py-1 border border-gray-400 min-w-[120px] shadow-sm">
                      <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Count Nodes</span>
                      <span className="text-xs font-black italic text-stone-850 tracking-tight">{filteredSavedStocks.length} Record Entries</span>
                    </div>
                    <div className="bg-white px-3 py-1 border border-gray-400 min-w-[140px] shadow-sm">
                      <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Sum Total Qty</span>
                      <span className="text-sm font-black italic text-indigo-950 tracking-tight">{totalOpeningQty.toLocaleString(undefined, {maximumFractionDigits: 3})} Units</span>
                    </div>
                    <div className="bg-white px-3 py-1 border border-gray-400 min-w-[150px] shadow-sm">
                      <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Sum Total Weight</span>
                      <span className="text-sm font-black italic text-emerald-950 tracking-tight">{(totalOpeningWt / 10).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3})} MT</span>
                    </div>
                  </div>
                  <div className="hidden md:block text-[8px] font-mono font-black italic text-neutral-100 pr-2 uppercase">Verified Opening Store baseline</div>
                </div>
              </div>
              );
            })() : (
              /* 15.2 Monthly Closing Stocks Ledger Grid layout */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-in fade-in duration-100">
                <div className="lg:col-span-8 space-y-3">
                  <div className="border border-gray-400 bg-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)] overflow-x-auto min-h-[300px]">
                    <table className="w-full border-collapse text-[10px]">
                      <thead className="bg-[#c0c0c0] font-black italic">
                        <tr className="border-b border-gray-400 h-8 text-slate-800 uppercase text-left  text-[9px] tracking-tight">
                          <th className="px-3 border-r border-slate-350 w-24">Date</th>
                          <th className="px-3 border-r border-slate-350 min-w-[150px]">Godown / Location</th>
                          <th className="px-3 border-r border-slate-350">Commodity</th>
                          <th className="px-3 border-r border-slate-350">Variety</th>
                          <th className="px-3 border-r border-slate-350">Grade Code</th>
                          <th className="px-3 border-r border-slate-350 text-right">Physical Bales</th>
                          <th className="px-3 border-r border-slate-350 text-right">Weight (MT)</th>
                          <th className="px-3 border-r border-slate-350 text-right">Rate / MT</th>
                          <th className="px-3 border-r border-slate-350 text-right font-black">Total Value (Rs.)</th>
                          <th className="px-2 text-center w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-250 font-bold text-slate-900">
                        {filteredClosingStocks.length > 0 ? (
                          filteredClosingStocks.map((row, i) => {
                            const isSelected = selectedClosingStockId === row.id;
                            return (
                              <tr 
                                key={row.id || i}
                                onClick={() => setSelectedClosingStockId(row.id || null)}
                                onDoubleClick={() => handleEditClosing(row)}
                                className={cn(
                                  "h-8 border-b border-gray-100 cursor-pointer hover:bg-[#ffeed0]/60 transition-colors",
                                  isSelected ? "bg-red-950 text-white" : (i % 2 === 0 ? "bg-white" : "bg-gray-50/40")
                                )}
                              >
                                <td className={cn("px-3 border-r border-slate-100 font-mono", isSelected ? "text-red-100 font-extrabold" : "text-stone-600")}>{row.stock_date}</td>
                                <td className={cn("px-3 border-r border-slate-100 font-extrabold uppercase truncate max-w-[180px]", isSelected ? "text-yellow-300" : "text-red-900")} title={row.godown}>{row.godown || "-"}</td>
                                <td className={cn("px-3 border-r border-slate-100 uppercase", isSelected ? "text-red-100" : "text-stone-700")}>{row.commodity || "RAW JUTE"}</td>
                                <td className={cn("px-3 border-r border-slate-100 uppercase font-extrabold", isSelected ? "text-stone-100" : "text-stone-850")}>{row.variety || "TOSSA"}</td>
                                <td className={cn("px-3 border-r border-slate-100 uppercase font-black", isSelected ? "text-yellow-250" : "text-slate-750")}>{row.grade || "-"}</td>
                                <td className={cn("px-3 border-r border-slate-100 text-right font-mono", isSelected ? "text-white" : "text-slate-700")}>{Number(row.no_of_bales).toLocaleString()}</td>
                                <td className={cn("px-3 border-r border-slate-100 text-right font-mono", isSelected ? "text-slate-205" : "text-emerald-800")}>{(Number(row.weight_qtl) / 10).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className={cn("px-3 border-r border-slate-100 text-right font-mono", isSelected ? "text-indigo-200" : "text-slate-650")}>₹ {(Number(row.rate_per_qtl) * 10).toFixed(2)}</td>
                                <td className={cn("px-3 border-r border-slate-100 text-right font-mono text-xs font-black", isSelected ? "text-green-300" : "text-indigo-950")}>₹ {Number(row.total_value).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-center items-center gap-1.5">
                                    <button
                                      onClick={() => handleEditClosing(row)}
                                      title="Edit Closing Record"
                                      className={cn(
                                        "p-1 hover:bg-black/15 rounded transition-all cursor-pointer border border-transparent",
                                        isSelected ? "text-blue-200 hover:text-white" : "text-blue-700 hover:border-blue-200"
                                      )}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClosing(row.id, `${row.grade} @ ${row.godown}`)}
                                      title="Delete Closing Record"
                                      className={cn(
                                        "p-1 hover:bg-black/15 rounded transition-all cursor-pointer border border-transparent",
                                        isSelected ? "text-red-300 hover:text-white" : "text-rose-700 hover:border-rose-200"
                                      )}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={10} className="py-20 text-center font-bold text-gray-400 uppercase italic tracking-wider">
                              No Monthly Opening Stock records reported. Use "New Monthly Record" to register.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Closing Summary stats bar */}
                  <div className="bg-[#808080] p-1 flex justify-between gap-1 items-center border border-black/10 ">
                    <div className="flex gap-2 flex-wrap pb-0.5">
                      <div className="bg-white px-3 py-1 border border-gray-400 min-w-[120px] shadow-sm">
                        <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Node Rows</span>
                        <span className="text-xs font-black italic text-stone-850 tracking-tight">{filteredClosingStocks.length} Record Entries</span>
                      </div>
                      <div className="bg-white px-3 py-1 border border-gray-400 min-w-[130px] shadow-sm">
                        <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Sum Total Bales</span>
                        <span className="text-sm font-black italic text-indigo-950 tracking-tight">{totalClosingBales.toLocaleString()} Bales</span>
                      </div>
                      <div className="bg-white px-3 py-1 border border-gray-400 min-w-[140px] shadow-sm">
                        <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Sum Total Weight</span>
                        <span className="text-sm font-black italic text-emerald-950 tracking-tight">{(totalClosingWt / 10).toLocaleString(undefined, {minimumFractionDigits: 2})} MT</span>
                      </div>
                      <div className="bg-white px-3 py-1 border border-gray-400 min-w-[180px] shadow-sm">
                        <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Store Assets Book Value</span>
                        <span className="text-sm font-black italic text-blue-900 tracking-tight">₹ {totalClosingValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                    <div className="hidden md:block text-[8px] font-mono font-black italic text-rose-100 pr-2 uppercase">Monthly Inventory Book Value</div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4 text-left">
                  {/* Date Wise Total Monthly Stock Report (Global Summary) */}
                  <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-3 shadow-xs space-y-2 flex flex-col">
                    <div className="border-b border-gray-400 pb-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-indigo-950 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-red-700 animate-pulse" />
                        Date Wise Monthly Stock Report
                      </span>
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-gray-500 bg-white/50 px-1 border border-gray-300">Latest Days</span>
                    </div>

                    <div className="bg-white border border-gray-400 h-[240px] overflow-y-auto">
                      <table className="w-full text-left text-[9px] border-collapse font-mono">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-300 sticky top-0 font-bold text-gray-600 ">
                            <th className="px-2 py-0.5 border-r border-gray-200">Stock Date</th>
                            <th className="px-2 py-0.5 text-center border-r border-gray-200">Entries</th>
                            <th className="px-2 py-0.5 text-right border-r border-gray-200">Bales</th>
                            <th className="px-2 py-0.5 text-right font-black">Weight (MT)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {dateWiseClosingList.map((rep) => {
                            const isSelectedDate = startDateFilter === rep.date && endDateFilter === rep.date;
                            return (
                              <tr 
                                key={rep.date} 
                                className="hover:bg-blue-50 cursor-pointer"
                                onClick={() => { setStartDateFilter(rep.date); setEndDateFilter(rep.date); }}
                              >
                                <td className="px-2 py-0.5 font-bold text-gray-700 flex items-center gap-1">
                                  <span className={cn("w-1.5 h-1.5 rounded-full bg-blue-600 inline-block", isSelectedDate && "bg-red-600 animate-pulse")} />
                                  {new Date(rep.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-2 py-0.5 text-center font-black text-slate-800">{rep.count} nodes</td>
                                <td className="px-2 py-0.5 text-right font-black text-blue-750">{rep.quantity.toLocaleString()}</td>
                                <td className="px-2 py-0.5 text-right font-black text-emerald-850">{(rep.weight / 10).toFixed(2)} MT</td>
                              </tr>
                            );
                          })}
                          {dateWiseClosingList.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-4 text-gray-400 uppercase font-bold text-[9px]">No closing calendar data loaded.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1 text-[8px] text-gray-500 font-bold  leading-normal">
                      <span>* Click on any date row to immediately load that day's records.</span>
                      {(startDateFilter || endDateFilter) && (
                        <button 
                          onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                          className="text-red-700 font-extrabold border border-red-300 hover:bg-red-50 px-1 bg-white cursor-pointer"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* Tab 2: Standard Live Valuation summary (Original Stock Summary Grid) */
          <>
            {/* Action Header */}
            <div className="flex bg-[#c0c0c0] p-1 border border-black/20 gap-2 items-center ">
               <div className="flex bg-white border border-gray-400 p-px flex-1">
                  <div className="bg-gray-100 flex items-center px-1.5 border-r border-gray-300">
                    <Search className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <input  id="filter_standard_valuation_2197" name="filter_standard_valuation" aria-label="Filter standard valuation lists by Commodity, Quality, or Grade..."
                    className="flex-1 text-xs px-2 py-1 outline-none font-bold" 
                    placeholder="Filter standard valuation lists by Commodity, Quality, or Grade..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="text-[10px] uppercase font-black text-red-700 px-2 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
               </div>
               <div className="flex gap-1 h-full font-bold">
                  <LegacyButton icon={Filter} label="Filters" />
                  <LegacyButton icon={Printer} label="Reports" />
                  <LegacyButton icon={Download} label="Export" onClick={handleExportLiveStockToCSV} />
               </div>
            </div>

            {/* Main Stock Grid */}
            <div className="border border-gray-400 bg-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)] overflow-x-auto ">
               <table className="w-full border-collapse text-[10px]">
                  <thead className="bg-[#c0c0c0] font-black italic text-slate-800">
                     <tr className="border-b border-gray-400 h-8 uppercase text-left">
                        <th className="px-6 border-r border-[#808080]/30 min-w-[200px]">Commodity Quality & Grade</th>
                        <th className="px-4 text-center border-r border-[#808080]/30 bg-green-50/30">Opening Stock (Bales)</th>
                        <th className="px-4 text-center border-r border-[#808080]/30 bg-indigo-50/30">Issue to Godown (+) (Bales)</th>
                        <th className="px-4 text-center border-r border-[#808080]/30 bg-red-50/30">Godown to Factory (-) (Bales)</th>
                        <th className="px-4 text-center border-r border-[#808080]/30 bg-blue-50/20">Current Stock Balance (Bales)</th>
                        <th className="px-6 text-right">Net Wt. Balance (MT)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-slate-750">
                     {(() => {
                       const liveStocks = calculateLiveStocks();
                       const filteredLive = liveStocks.filter(item => {
                         if (!searchQuery) return true;
                         const q = searchQuery.toLowerCase().trim();
                         return item.grade.toLowerCase().includes(q);
                       });

                       if (filteredLive.length === 0) {
                         return (
                           <tr>
                             <td colSpan={6} className="px-6 py-4 text-center text-gray-500 italic">
                               No matching dynamic stock balances found.
                             </td>
                           </tr>
                         );
                       }

                       return filteredLive.map((item, idx) => (
                         <StockItemRow
                           key={idx}
                           name={item.grade}
                           opening={item.openingQty.toLocaleString()}
                           incoming={item.incomingQty.toLocaleString()}
                           outgoing={item.outgoingQty.toLocaleString()}
                           balance={item.balanceQty.toLocaleString()}
                           weight={(item.balanceWt / 10).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         />
                       ));
                     })()}
                     {/* Empty grid lines */}
                     {Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="h-8 border-b border-gray-50 opacity-10"><td colSpan={6}></td></tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Summary Footer */}
            <div className="bg-[#808080] p-1 flex justify-between gap-1 items-center border border-black/10 ">
               <div className="flex gap-1 h-full">
                  <div className="bg-white px-3 py-1 border border-gray-400 min-w-[120px]">
                     <span className="text-[8px] font-bold text-gray-500 uppercase leading-none block">Inventory Book Value (Est. @ ₹65,000/MT)</span>
                     <span className="text-sm font-black italic text-blue-900 tracking-tighter">
                       ₹ {Math.max(0, currentClosingStockWeight * 6500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </span>
                  </div>
               </div>
               <div className="bg-[#c0c0c0] px-4 py-1 border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] flex items-center gap-2">
                  <Clock className="h-3 w-3 text-gray-600" />
                  <span className="text-[9px] font-bold uppercase italic text-gray-600 tracking-widest">Last valuation: Just Now</span>
               </div>
            </div>
          </>
        )}
      </div>

      {/* Retro Popup Form Dialog Modal (Replaces left sidebar screenshot 1 form with popover popup modal) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#d4d0c8] border-2 border-white shadow-[4px_4px_16px_rgba(0,0,0,0.45),inset_1.5px_1.5px_0px_white] w-full max-w-lg flex flex-col rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            
            {/* Old School Windows Titlebar */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white px-4 py-2 flex items-center justify-between border-b border-white ">
              <div className="flex items-center gap-2">
                <span>📁</span>
                <span className="text-xs font-black uppercase tracking-wider font-sans">
                  {isEditing ? 'Modify Stock Ledger Entry' : 'Add New Store Ledger Row'}
                </span>
              </div>
              <button 
                onClick={() => setIsFormModalOpen(false)}
                className="bg-[#d4d0c8] text-slate-800 border-2 border-white shadow-[1px_1px_0px_black] active:shadow-[inset_1px_1px_0px_black] h-5 w-5 flex items-center justify-center font-black text-xs cursor-pointer "
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-legacy-bg flex-1 overflow-y-auto max-h-[80vh]">
              {stockSubTab === 'opening' ? (
                /* Opening Stock Input Form elements */
                <LegacyFieldset legend={isEditing ? "🔧 UPDATE OPENING STOCK" : "➕ ADD NEW OPENING RECORD"}>
                  <form onSubmit={handleSubmit} className="space-y-3 font-semibold text-slate-800 text-xs">
                    
                    {/* Opening Date */}
                    <div>
                      <label className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Opening Date *
                      </label>
                      <div className="flex border border-gray-400 bg-white">
                        <div className="px-1.5 bg-gray-100 flex items-center border-r border-gray-400">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <input  id="formstate_opening_date_2326" name="formstate_opening_date" aria-label="formstate opening date"
                          type="date"
                          required
                          value={formState.opening_date}
                          onChange={(e) => setFormState(p => ({ ...p, opening_date: e.target.value }))}
                          className="flex-1 px-2 py-1 bg-white outline-none font-bold text-xs"
                        />
                      </div>
                    </div>

                    {/* Godown */}
                    <div>
                      <label htmlFor="godown_2341" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Godown *
                      </label>
                      <input  id="godown_2341" name="godown" aria-label="Godown *"
                        type="text"
                        required
                        list="godown_op_datalist"
                        value={formState.godown}
                        onChange={(e) => setFormState(p => ({ ...p, godown: e.target.value }))}
                        placeholder="Select or Type Godown..."
                        className="w-full border border-gray-400 bg-white px-2 py-1 font-bold text-xs outline-none uppercase font-mono"
                      />
                      <datalist id="godown_op_datalist">
                        {mergedGodowns.map((g, i) => (
                          <option key={i} value={g.gdn_name} />
                        ))}
                      </datalist>
                    </div>

                    {/* Area Station */}
                    <div>
                      <label htmlFor="area_station_2362" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Area Station *
                      </label>
                      <input  id="area_station_2362" name="area_station" aria-label="Area Station *"
                        type="text"
                        required
                        list="area_op_datalist"
                        value={formState.area}
                        onChange={(e) => setFormState(p => ({ ...p, area: e.target.value }))}
                        placeholder="Select or Type Area..."
                        className="w-full border border-gray-400 bg-white px-2 py-1 font-bold text-xs outline-none uppercase font-mono"
                      />
                      <datalist id="area_op_datalist">
                        {mergedAreas.map((a, i) => {
                          const aName = a.area_name || a.name || '';
                          return <option key={i} value={aName} />;
                        })}
                      </datalist>
                    </div>

                    {/* Component Grade */}
                    <div>
                      <label htmlFor="component_grade_2384" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Component Grade *
                      </label>
                      <input  id="component_grade_2384" name="component_grade" aria-label="Component Grade *"
                        type="text"
                        required
                        list="grade_op_datalist"
                        value={formState.grade}
                        onChange={(e) => setFormState(p => ({ ...p, grade: e.target.value }))}
                        placeholder="Select or Type Grade..."
                        className="w-full border border-gray-400 bg-white px-2 py-1 font-bold text-xs outline-none uppercase font-mono"
                      />
                      <datalist id="grade_op_datalist">
                        {mergedGrades.map((g, i) => {
                          const gName = g.grade_name || g.name || g.code || '';
                          return <option key={i} value={gName} />;
                        })}
                      </datalist>
                    </div>

                    {/* JCI status */}
                    <div>
                      <label htmlFor="is_j_c_i_govt_supplied_2406" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Is J.C.I Govt Supplied? *
                      </label>
                      <select
 id="is_j_c_i_govt_supplied_2406" name="is_j_c_i_govt_supplied" aria-label="Is J.C.I Govt Supplied? *"                        required
                        value={formState.jci}
                        onChange={(e) => setFormState(p => ({ ...p, jci: e.target.value }))}
                        className="w-full border border-gray-400 bg-white px-2 py-1 font-bold text-xs outline-none"
                      >
                        <option value="No">No - Private/Regular Commercial</option>
                        <option value="Yes">Yes - Government JCI</option>
                      </select>
                    </div>

                    {/* Unit & quantity */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="unit_master_2423" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Unit Master *
                        </label>
                        <select  id="unit_master_2423" name="unit_master" aria-label="Unit Master *"
                          required
                          value={formState.unit}
                          onChange={(e) => setFormState(p => ({ ...p, unit: e.target.value }))}
                          className="w-full border border-gray-400 bg-white px-2 py-1 font-bold text-xs outline-none uppercase cursor-pointer"
                        >
                          <option value="">-- SELECT UNIT --</option>
                          {mergedUnits.map((u, i) => (
                            <option key={i} value={u.unit_name}>{u.unit_name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="quantity_2440" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Quantity *
                        </label>
                        <input  id="quantity_2440" name="quantity" aria-label="Quantity *"
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="0.000"
                          value={formState.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormState(p => {
                              const qty = parseFloat(val) || 0;
                              const wt = parseFloat(p.weight) || 0;
                              const avg = qty > 0 ? (wt / qty).toFixed(3) : '';
                              return { ...p, quantity: val, avg_weight: avg };
                            });
                          }}
                          className="w-full border border-gray-400 bg-white px-3 py-1 font-bold text-xs outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Weight and Avg Weight Split Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="net_weight_quintals_2467" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Net Weight (Quintals) *
                        </label>
                        <input  id="net_weight_quintals_2467" name="net_weight_quintals" aria-label="Net Weight (Quintals) *"
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={formState.weight}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormState(p => {
                              const qty = parseFloat(p.quantity) || 0;
                              const wt = parseFloat(val) || 0;
                              const avg = qty > 0 ? (wt / qty).toFixed(3) : '';
                              return { ...p, weight: val, avg_weight: avg };
                            });
                          }}
                          className="w-full border border-gray-400 bg-white px-3 py-1 font-bold text-xs outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label htmlFor="avg_wt_wt_qty_2491" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Avg Wt (Wt / Qty)
                        </label>
                        <input  id="avg_wt_wt_qty_2491" name="avg_wt_wt_qty" aria-label="Avg Wt (Wt / Qty)"
                          type="text"
                          readOnly
                          placeholder="0.000"
                          value={formState.avg_weight || '0.000'}
                          className="w-full border border-gray-400 bg-teal-50/50 px-3 py-1 font-black text-xs outline-none font-mono text-teal-900 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Submissions */}
                    <div className="flex gap-2 pt-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsFormModalOpen(false)}
                        className="px-4 py-1.5 bg-gray-500 border-2 border-white shadow-[1px_1px_0px_black] font-black text-[10px] text-white uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-1.5 bg-[#1e40af] border-2 border-white shadow-[1px_1px_0px_black] text-white font-black uppercase text-[10px] tracking-wider cursor-pointer"
                      >
                        {loading ? 'Saving...' : '💾 Save Record'}
                      </button>
                    </div>

                  </form>
                </LegacyFieldset>
              ) : (
                /* Closing Stock Input Form elements */
                <LegacyFieldset legend={isEditing ? "🔧 UPDATE CLOSING INVENTORY" : "➕ RECORD CLOSING STOCK"}>
                  <form onSubmit={handleClosingSubmit} className="space-y-3 font-semibold text-slate-800 text-xs">
                    
                    {/* Stock Date */}
                    <div>
                      <label className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Opening Stock Audit Date *
                      </label>
                      <div className="flex border border-gray-400 bg-white">
                        <div className="px-1.5 bg-gray-100 flex items-center border-r border-gray-400">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <input  id="closingformstate_stock_da_2535" name="closingformstate_stock_da" aria-label="closingformstate stock da"
                          type="date"
                          required
                          value={closingFormState.stock_date}
                          onChange={(e) => setClosingFormState(p => ({ ...p, stock_date: e.target.value }))}
                          className="flex-1 px-2 py-1 bg-white outline-none font-bold text-xs"
                        />
                      </div>
                    </div>

                    {/* Godown Location */}
                    <div>
                      <label htmlFor="godown_location_2550" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Godown Location *
                      </label>
                      <select
 id="godown_location_2550" name="godown_location" aria-label="Godown Location *"                        required
                        value={closingFormState.godown}
                        onChange={(e) => setClosingFormState(p => ({ ...p, godown: e.target.value }))}
                        className="w-full border border-gray-400 bg-white px-2 py-1 font-bold text-xs outline-none"
                      >
                        <option value="">-- SELECT STORAGE LOCATION --</option>
                        {mergedGodowns.map((g, i) => (
                          <option key={i} value={g.gdn_name}>
                            {g.gdn_name} {g.gdn_code ? `[${g.gdn_code}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Commodity & Variety */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="commodity_2571" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Commodity *
                        </label>
                        <input  id="commodity_2571" name="commodity" aria-label="Commodity *"
                          type="text"
                          required
                          value={closingFormState.commodity}
                          onChange={(e) => setClosingFormState(p => ({ ...p, commodity: e.target.value }))}
                          className="w-full border border-gray-400 bg-white px-2.5 py-1 font-bold text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="variety_2583" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Variety
                        </label>
                        <input  id="variety_2583" name="variety" aria-label="Variety"
                          type="text"
                          value={closingFormState.variety}
                          onChange={(e) => setClosingFormState(p => ({ ...p, variety: e.target.value }))}
                          className="w-full border border-gray-400 bg-white px-2.5 py-1 font-bold text-xs outline-none uppercase"
                          placeholder="e.g. TOSSA"
                        />
                      </div>
                    </div>

                    {/* Quality Grade */}
                    <div>
                      <label htmlFor="quality_grade_rating_2598" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Quality Grade Rating *
                      </label>
                      <select
 id="quality_grade_rating_2598" name="quality_grade_rating" aria-label="Quality Grade Rating *"                        required
                        value={closingFormState.grade}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClosingFormState(p => ({ ...p, grade: val }));
                          if (val === 'CUSTOM_MANUAL') {
                            setShowCustomGradeClosing(true);
                          } else {
                            setShowCustomGradeClosing(false);
                            setCustomGradeValueClosing('');
                          }
                        }}
                        className="w-full border border-gray-400 bg-white px-2 py-1 font-bold text-xs outline-none"
                      >
                        <option value="">-- SELECT GRADE --</option>
                        {mergedGrades.map((g, i) => {
                          const gName = g.grade_name || g.name || g.code || '';
                          return (
                            <option key={i} value={gName}>{gName}</option>
                          );
                        })}
                        <option value="CUSTOM_MANUAL">✍ WRITE CUSTOM SYSTEM GRADE</option>
                      </select>

                      {showCustomGradeClosing && (
                        <input  id="type_custom_jute_grade_na_2624" name="type_custom_jute_grade_na" aria-label="Type custom Jute Grade name..."
                          type="text"
                          required
                          placeholder="Type custom Jute Grade name..."
                          value={customGradeValueClosing}
                          onChange={(e) => setCustomGradeValueClosing(e.target.value)}
                          className="w-full mt-1.5 border border-[#808080] bg-yellow-50/50 p-1 px-2 text-xs font-bold outline-none uppercase"
                        />
                      )}
                    </div>

                    {/* Physical Bales & Weight Estimation */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="no_of_bales_2641" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px]  font-mono">
                          No. of Bales *
                        </label>
                        <input  id="no_of_bales_2641" name="no_of_bales" aria-label="No. of Bales *"
                          type="number"
                          required
                          min="0"
                          value={closingFormState.no_of_bales}
                          onChange={(e) => handleClosingFieldChange('no_of_bales', e.target.value)}
                          className="w-full border border-gray-400 bg-white px-3 py-1 font-bold text-xs outline-none font-mono"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="net_weight_qtl_2655" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Net Weight (Qtl) *
                        </label>
                        <input  id="net_weight_qtl_2655" name="net_weight_qtl" aria-label="Net Weight (Qtl) *"
                          type="number"
                          required
                          min="0"
                          step="any"
                          value={closingFormState.weight_qtl}
                          onChange={(e) => handleClosingFieldChange('weight_qtl', e.target.value)}
                          className="w-full border border-gray-400 bg-white px-3 py-1 font-bold text-xs outline-none font-mono"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Rate & Asset Value calculation */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="rate_per_qtl_2674" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Rate per Qtl *
                        </label>
                        <input  id="rate_per_qtl_2674" name="rate_per_qtl" aria-label="Rate per Qtl *"
                          type="number"
                          required
                          min="0"
                          step="any"
                          value={closingFormState.rate_per_qtl}
                          onChange={(e) => handleClosingFieldChange('rate_per_qtl', e.target.value)}
                          className="w-full border border-gray-400 bg-white px-3 py-1 font-bold text-xs outline-none font-mono"
                          placeholder="6500"
                        />
                      </div>
                      <div>
                        <label htmlFor="asset_book_value_rs_2689" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                          Asset Book Value (Rs.)
                        </label>
                        <input  id="asset_book_value_rs_2689" name="asset_book_value_rs" aria-label="Asset Book Value (Rs.)"
                          type="text"
                          disabled
                          value={Number(closingFormState.total_value).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          className="w-full border border-gray-300 bg-gray-50/70 px-3 py-1 font-black text-xs outline-none text-right font-mono text-emerald-800"
                        />
                      </div>
                    </div>

                    {/* Remarks & auditing operator ID */}
                    <div>
                      <label htmlFor="remarks_storage_quality_n_2703" className="block mb-1 font-black text-indigo-950 uppercase tracking-widest text-[9px] ">
                        Remarks / Storage quality notes
                      </label>
                      <input  id="remarks_storage_quality_n_2703" name="remarks_storage_quality_n" aria-label="Remarks / Storage quality notes"
                        type="text"
                        value={closingFormState.remarks}
                        onChange={(e) => setClosingFormState(p => ({ ...p, remarks: e.target.value }))}
                        className="w-full border border-gray-400 bg-white p-1 px-2.5 text-xs font-bold outline-none"
                        placeholder="e.g. Wet stack audits completed alright."
                      />
                    </div>

                    {/* Submissions */}
                    <div className="flex gap-2 pt-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsFormModalOpen(false)}
                        className="px-4 py-1.5 bg-gray-500 border-2 border-white shadow-[1px_1px_0px_black] font-black text-[10px] text-white uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-1.5 bg-red-900 border-2 border-white shadow-[1px_1px_0px_black] text-white font-black uppercase text-[10px] tracking-wider cursor-pointer font-sans"
                      >
                        {loading ? 'Creating...' : '💾 Register Closing'}
                      </button>
                    </div>

                  </form>
                </LegacyFieldset>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Retro Dot-Matrix Print Modal (Opening Certificate) */}
      <PrintModal 
        isOpen={isPrintingModalOpen} 
        onClose={() => setIsPrintingModalOpen(false)} 
        title="RETRO OPENING STOCK LEDGER CERTIFICATE"
      >
        {printData && (
          <div className="p-4 bg-[#a0a0a0] flex justify-center overflow-x-auto print:bg-white print:p-0">
            <div className="print-continuous-paper-container flex bg-white shadow-2xl border border-gray-400 select-text pr-px print:shadow-none print:border-none">
              
              {/* Left Tractor Feed band with holes */}
              <div id="tractor-feed-holes-left" className="w-[32px] bg-[#fdfaf2] border-r border-red-200 flex flex-col justify-between py-6 shrink-0  print:hidden">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                ))}
              </div>

              {/* Main Print Slip Sheet */}
              <div id="print-sheet-wrapper" className="w-[840px] bg-white p-6 md:p-8 flex flex-col justify-between select-text text-black print:p-0 print:w-full">
                
                {/* Header */}
                <div>
                  <div className="flex justify-between items-start border-b-2 border-dashed border-red-650 pb-4">
                    <div className="text-left max-w-[450px]">
                      <h1 className="font-sans font-black text-2xl tracking-tight text-red-650 leading-none">BALLY JUTE COMPANY LIMITED</h1>
                      <p className="text-[10px] font-bold text-red-700/95 tracking-wide mt-1.5 uppercase font-mono">AUTHORIZED MILL PREMISES</p>
                      <p className="text-[9px] text-gray-500 font-bold font-sans mt-0.5 leading-none">Est. 1890 | Cable: "JUTEMILL" | Fax: +91-33-2654-XXXX</p>
                    </div>
                    <div className="text-right font-mono text-[10px] text-gray-600 bg-gray-50 p-2 border border-gray-300">
                      <p className="font-bold">SYSTEM DOC ID: <span className="text-stone-900 font-black">#OS-{printData.id?.slice(0,6).toUpperCase() || 'N/A'}</span></p>
                      <p className="mt-0.5">PRINT DATE: {new Date().toLocaleDateString('en-GB')}</p>
                      <p className="mt-0.5">TIME RECEIVED: {new Date().toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* Document Title Banner */}
                  <div className="my-6 text-center">
                    <div className="inline-block border-2 border-dashed border-red-600 py-1.5 px-6">
                      <h2 className="font-sans font-black text-sm tracking-widest text-red-800 uppercase">
                        MASTER OPENING STOCK CERTIFICATE
                      </h2>
                      <p className="text-[8px] font-mono font-black text-gray-500 tracking-wider mt-0.5 uppercase">
                        AUTHORIZED LEDGER VOUCHER • PERMANENT BOOK STATEMENT
                      </p>
                    </div>
                  </div>

                  {/* Main Details Grid */}
                  <div className="grid grid-cols-2 gap-6 font-mono text-xs">
                    <div className="space-y-2 border border-gray-300 p-3 bg-stone-50/50">
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Ledger Entry Date:</span> <strong className="text-stone-900 font-black">{printData.opening_date}</strong></p>
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Godown Location:</span> <strong className="text-blue-900 font-black uppercase text-sm">{printData.godown}</strong></p>
                      <p><span className="text-gray-500 font-bold uppercase block text-[9px]">Station / Depot Area:</span> <strong className="text-stone-800 font-bold uppercase">{printData.area || 'MAIN DEPOT'}</strong></p>
                    </div>
                    <div className="space-y-2 border border-gray-300 p-3 bg-stone-50/50">
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Jute Quality Grade Rating:</span> <strong className="text-red-750 font-black text-sm uppercase">{printData.grade}</strong></p>
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Government Supplies (JCI):</span> <strong className="text-stone-900 font-bold uppercase">{printData.jci === 'Yes' ? 'YES - GOVT MANDATED ALLOCATION' : 'NO - COMMERCIAL MARKET STOCK'}</strong></p>
                      <p><span className="text-gray-500 font-bold uppercase block text-[9px]">Permanent Unit Master:</span> <strong className="text-stone-800 font-bold uppercase">{printData.unit || 'BALES'}</strong></p>
                    </div>
                  </div>

                  {/* Large Quantity Statement Panel */}
                  <div className="my-6 border border-gray-400 bg-red-50/10 p-4">
                    <div className="grid grid-cols-3 gap-4 text-center divide-x divide-gray-350 bg-stone-50/50 p-2 border border-gray-200">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold text-red-800 font-sans uppercase tracking-widest block mb-1">Declared Ledger Quantity</span>
                        <span className="text-xl font-black font-mono text-indigo-950 tracking-tight leading-none">
                          {Number(printData.quantity).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 3})}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">{printData.unit || 'BALES'}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold text-red-800 font-sans uppercase tracking-widest block mb-1">Total Book Weight</span>
                        <span className="text-xl font-black font-mono text-teal-900 tracking-tight leading-none">
                          {(Number(printData.weight) / 10).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3})}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">MT</span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold text-red-800 font-sans uppercase tracking-widest block mb-1">Average Weight</span>
                        <span className="text-xl font-black font-mono text-amber-950 tracking-tight leading-none">
                          {printData.avg_weight ? (Number(printData.avg_weight) / 10).toFixed(4) : (Number(printData.quantity) > 0 ? ((Number(printData.weight) / Number(printData.quantity)) / 10).toFixed(4) : '0.0000')}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">MT/{printData.unit || 'BALES'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Declaration & Clauses */}
                  <div className="text-[9px] text-gray-500 leading-relaxed font-sans font-medium space-y-1 mt-6 border-t border-gray-200 pt-3 text-left">
                    <p>1. CERTIFIED STATEMENT: This represents our permanent opening balance registered into the stock ledger node of the Bally Jute Company Limited on the aforesaid date. This value is legally binding and serves as the official baseline for active inbound mill inspections, Amad arrivals, and physical storage counts.</p>
                    <p>2. CORRECTION CLAUSE: Any revisions to the opening stock metrics require explicit high-level administrator approval and must trigger a permanent trace event log in the secure central audit history.</p>
                  </div>
                </div>

                {/* Footer and Signature blocks */}
                <div className="grid grid-cols-12 gap-4 items-end mt-12 border-t border-gray-300 pt-6">
                  <div className="col-span-7 text-[8px] text-gray-400 uppercase font-mono font-medium leading-tight text-left">
                    <p className="font-extrabold text-[#2a3088]">SYSTEM AUTH NO: BJ-OS-SYS-{Math.floor(100000 + Math.random() * 900000)}</p>
                    <p className="mt-1">Generated electronically inside the Mill ERP Latest Stock Control Room.</p>
                    <p>Original file persists securely under table reference 'opening_stock'.</p>
                  </div>
                  <div className="col-span-5 flex flex-col justify-between text-center">
                    <p className="font-black text-[11px] tracking-wide uppercase font-sans text-red-800/90 leading-none">For, BALLY JUTE COMPANY LIMITED</p>
                    <div className="mt-10 flex flex-col items-center">
                      <div className="w-48 border-t border-dashed border-gray-400" />
                      <p className="font-bold text-[9px] mt-1 text-gray-650 uppercase font-sans leading-none tracking-wider font-extrabold">LEDGER MASTER CAPTAIN</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Tractor Feed band with holes */}
              <div id="tractor-feed-holes-right" className="w-[32px] bg-[#fdfaf2] border-l border-[#dcd8cc] flex flex-col justify-between py-6 shrink-0  print:hidden">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                ))}
              </div>

            </div>
          </div>
        )}
      </PrintModal>

      {/* Retro Dot-Matrix Print Modal (Closing Certificate) */}
      <PrintModal 
        isOpen={isClosingPrintModalOpen} 
        onClose={() => setIsClosingPrintModalOpen(false)} 
        title="RETRO MONTHLY CLOSING STOCK STANDARD SLIP"
      >
        {printClosingData && (
          <div className="p-4 bg-[#606060] flex justify-center overflow-x-auto print:bg-white print:p-0">
            <div className="print-continuous-paper-container flex bg-white shadow-2xl border border-gray-400 select-text pr-px print:shadow-none print:border-none">
              
              {/* Left Tractor Feed band with holes */}
              <div id="tractor-feed-holes-left" className="w-[32px] bg-[#fdfaf2] border-r border-[#edd8cc] flex flex-col justify-between py-6 shrink-0 print:hidden ">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                ))}
              </div>

              {/* Main Print Slip Sheet */}
              <div id="print-sheet-wrapper" className="w-[840px] bg-white p-6 md:p-8 flex flex-col justify-between select-text text-black print:p-0 print:w-full">
                
                {/* Header */}
                <div>
                  <div className="flex justify-between items-start border-b-2 border-dashed border-blue-900 pb-4">
                    <div className="text-left max-w-[450px]">
                      <h1 className="font-sans font-black text-2xl tracking-tight text-blue-900 leading-none">BALLY JUTE COMPANY LIMITED</h1>
                      <p className="text-[10px] font-bold text-blue-950/95 tracking-wide mt-1.5 uppercase font-mono">AUTHORIZED MILL PREMISES</p>
                      <p className="text-[9px] text-gray-500 font-bold font-sans mt-0.5 leading-none">Est. 1890 | Cable: "JUTEMILL" | Fax: +91-33-2654-XXXX</p>
                    </div>
                    <div className="text-right font-mono text-[10px] text-gray-600 bg-gray-50 p-2 border border-gray-300">
                      <p className="font-bold">SYSTEM DOC ID: <span className="text-stone-900 font-black">#CS-{printClosingData.id?.slice(0,6).toUpperCase() || 'N/A'}</span></p>
                      <p className="mt-0.5">AUDIT DATE: {printClosingData.stock_date}</p>
                      <p className="mt-0.5">PRINT DATE: {new Date().toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>

                  {/* Document Title Banner */}
                  <div className="my-6 text-center">
                    <div className="inline-block border-2 border-dashed border-red-800 py-1.5 px-6">
                      <h2 className="font-sans font-black text-sm tracking-widest text-red-900 uppercase">
                        MONTHLY INVENTORY CLOSING CERTIFICATE
                      </h2>
                      <p className="text-[8px] font-mono font-black text-gray-500 tracking-wider mt-0.5 uppercase">
                        VALUED ASSET REPORT • OFFICIAL STOCK STATEMENT
                      </p>
                    </div>
                  </div>

                  {/* Main Details Grid */}
                  <div className="grid grid-cols-2 gap-6 font-mono text-xs">
                    <div className="space-y-2 border border-gray-300 p-3 bg-stone-50/50 text-left">
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Stock Valuation Date:</span> <strong className="text-stone-900 font-black">{printClosingData.stock_date}</strong></p>
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Warehousing Godown:</span> <strong className="text-blue-900 font-black uppercase text-sm">{printClosingData.godown}</strong></p>
                      <p><span className="text-gray-500 font-bold uppercase block text-[9px]">Reported Commodity Code:</span> <strong className="text-stone-800 font-bold uppercase">{printClosingData.commodity || 'RAW JUTE'}</strong></p>
                    </div>
                    <div className="space-y-2 border border-gray-300 p-3 bg-stone-50/50 text-left">
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Standard Variety:</span> <strong className="text-blue-900 font-black uppercase text-sm">{printClosingData.variety || 'TOSSA'}</strong></p>
                      <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-500 font-bold uppercase block text-[9px]">Associated Jute Grade:</span> <strong className="text-red-750 font-black text-sm uppercase">{printClosingData.grade}</strong></p>
                      <p><span className="text-gray-500 font-bold uppercase block text-[9px]">Auditing Inspector ID:</span> <strong className="text-stone-900 font-bold uppercase">{printClosingData.recorded_by || 'ADMIN'}</strong></p>
                    </div>
                  </div>

                  {/* Large Quantity Statement Panel */}
                  <div className="my-6 border border-gray-400 bg-emerald-50/10 p-4">
                    <div className="grid grid-cols-3 gap-4 text-center divide-x divide-gray-300">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-widest block mb-1">Physical Bales</span>
                        <span className="text-2xl font-black font-mono text-indigo-950 tracking-tight leading-none">
                          {Number(printClosingData.no_of_bales).toLocaleString()}
                          <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">Bales</span>
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-widest block mb-1 font-mono">Net Book Weight</span>
                        <span className="text-2xl font-black font-mono text-teal-900 tracking-tight leading-none">
                          {(Number(printClosingData.weight_qtl) / 10).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">MT</span>
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-widest block mb-1 font-mono">Billing Rate</span>
                        <span className="text-2xl font-black font-mono text-yellow-800 tracking-tight leading-none">
                          ₹{(Number(printClosingData.rate_per_qtl) * 10).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">/MT</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Valuation Banner */}
                  <div className="my-3 border bg-[#000080]/5 border-blue-900 p-4 text-center select-text">
                    <p className="text-[10px] font-bold text-indigo-900 font-sans uppercase tracking-widest leading-none">Valued Inventory Asset Book Value</p>
                    <p className="text-3xl font-black font-mono text-red-900 tracking-tighter italic mt-1 pb-1">
                      ₹ {Number(printClosingData.total_value).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                    <p className="text-[9px] font-bold font-sans text-stone-600 mt-1 uppercase leading-none italic">
                      Remarks: {printClosingData.remarks || 'No issues noticed. All stocks registered safely.'}
                    </p>
                  </div>

                  {/* Declaration & Clauses */}
                  <div className="text-[9px] text-gray-500 leading-relaxed font-sans font-medium space-y-1 mt-6 border-t border-gray-200 pt-3 text-left">
                    <p>1. INVENTORY STATEMENT: This standard balance verification certificate is an authorized inventory document under reference 'closing_stock'. Recorded book value asset metrics serve as permanent tax audit records for the Bally Jute Company Limited on physical stock levels.</p>
                    <p>2. CORRECTION FACTOR: Any manually registered discrepancy during storage auditing must trigger formal ledger modifications in compliance with physical counts.</p>
                  </div>
                </div>

                {/* Footer and Signature blocks */}
                <div className="grid grid-cols-12 gap-4 items-end mt-12 border-t border-gray-300 pt-6">
                  <div className="col-span-7 text-[8px] text-gray-400 uppercase font-mono font-medium leading-tight text-left">
                    <p className="font-extrabold text-[#2a3088]">SYSTEM AUTH NO: BJ-CS-SYS-{Math.floor(100000 + Math.random() * 900000)}</p>
                    <p className="mt-1">Generated electronically inside the Mill ERP Latest Stock Control Room.</p>
                    <p>Store record persists securely under central reference table 'closing_stock'.</p>
                  </div>
                  <div className="col-span-5 flex flex-col justify-between text-center">
                    <p className="font-black text-[11px] tracking-wide uppercase font-sans text-red-800/90 leading-none">For, BALLY JUTE COMPANY LIMITED</p>
                    <div className="mt-10 flex flex-col items-center">
                      <div className="w-48 border-t border-dashed border-gray-400" />
                      <p className="font-bold text-[9px] mt-1 text-gray-650 uppercase font-sans leading-none tracking-wider font-extrabold">LEDGER MASTER CAPTAIN</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Tractor Feed band with holes */}
              <div id="tractor-feed-holes-right" className="w-[32px] bg-[#fdfaf2] border-l border-[#ecd8cc] flex flex-col justify-between py-6 shrink-0 print:hidden ">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                ))}
              </div>

            </div>
          </div>
        )}
      </PrintModal>

      {/* Secure Auditing Activity Logs Modal */}
      

      {/* Capacity Breakdown Audit Popup Modal Dialog */}
      {showCapacityPopup && (() => {
        const gwtTotalQty = filteredSavedStocks.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
        const gwtTotalWeight = filteredSavedStocks.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
        const distinctGodowns = Array.from(new Set(filteredSavedStocks.map(r => String(r.godown || '').trim().toUpperCase()).filter(Boolean)));
        const gwtDistinctGodownsCount = distinctGodowns.length;

        const activeGdnCapacityMT = distinctGodowns.reduce((acc, name) => {
          const info = getGodownCapacityAndName(name);
          return acc + info.capacity;
        }, 0);

        const allGdNodes = DEFAULT_GODOWNS.map((g) => {
          const name = g.gdn_name || g.gdn_code;
          const cap = Number(g.gdn_capacity || 600);
          const records = filteredSavedStocks.filter(r => {
            const resolved = getGodownCapacityAndName(r.godown || "");
            return resolved.name.toLowerCase() === name.toLowerCase();
          });
          
          const storedWeight = records.reduce((sum, r) => sum + Number(r.weight || 0), 0);
          const storedQty = records.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
          const rawUtil = cap > 0 ? (storedWeight / cap) * 100 : 0;
          
          const gradesMap: { [grade: string]: number } = {};
          records.forEach(r => {
            const gd = r.grade || "Unassigned";
            gradesMap[gd] = (gradesMap[gd] || 0) + Number(r.weight || 0);
          });
          
          const gradeBreakdown = Object.entries(gradesMap)
            .map(([grd, wt]) => `${grd}: ${wt.toFixed(2)} MT`)
            .join(", ");

          return {
            name,
            code: g.gdn_code,
            shortName: g.gdn_short_name || name,
            capacity: cap,
            storedWeight,
            storedQty,
            utilPercent: Math.min(100, rawUtil),
            rawUtil,
            isActive: storedWeight > 0.001,
            gradeBreakdown: gradeBreakdown || "No stocks",
            recordsCount: records.length
          };
        });

        const filteredGdNodes = allGdNodes.filter(node => {
          const q = popupSearchQuery.toLowerCase();
          return (
            node.name.toLowerCase().includes(q) ||
            node.code.toLowerCase().includes(q) ||
            node.gradeBreakdown.toLowerCase().includes(q)
          );
        });

        const totalCapSum = DEFAULT_GODOWNS.reduce((acc, current) => acc + current.gdn_capacity, 0);

        return (
          <div role="dialog" className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-[#d4d0c8] border-2 border-white shadow-[4px_4px_24px_rgba(0,0,0,0.65)] w-full max-w-4xl p-1 animate-in zoom-in-95 duration-150 flex flex-col rounded-md overflow-hidden">
              
              {/* Retro Windows Title Bar */}
              <div className="bg-[#000080] text-white p-2.5 text-xs font-black uppercase tracking-wider flex justify-between items-center ">
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-[#80ffd0]" />
                  <span>📊 Jute Godown Capacity & Allocation Audit Registry</span>
                </span>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCapacityPopup(false);
                    setPopupSearchQuery("");
                  }}
                  className="bg-[#d4d0c8] text-black border border-white hover:bg-red-655 hover:text-white font-extrabold text-[12px] leading-none h-6 w-6 flex items-center justify-center p-0 shadow-[1px_1px_0_0_black]"
                  title="Close Audit Registry View"
                >
                  ✕
                </button>
              </div>

              {/* Main Content Area */}
              <div className="bg-white p-4 border border-black/10 space-y-4 max-h-[70vh] overflow-y-auto text-slate-800 text-left">
                
                {/* Summary Section with Bento-styled KPI Mini-cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#f1f5f9] p-3 rounded-lg border border-slate-200">
                  <div className="bg-white border border-slate-200 p-2 text-center rounded shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Total Active Capacity</span>
                    <span className="text-lg font-black text-slate-800">{activeGdnCapacityMT.toLocaleString()} MT</span>
                    <span className="text-[8px] text-slate-400 block mt-0.5 font-extrabold">Sum of {gwtDistinctGodownsCount} Active Godowns</span>
                  </div>
                  <div className="bg-white border border-slate-200 p-2 text-center rounded shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Active Stored Weight</span>
                    <span className="text-lg font-black text-emerald-700">{(gwtTotalWeight / 10).toFixed(2)} MT</span>
                    <span className="text-[8px] text-emerald-600 block mt-0.5 font-extrabold">{gwtTotalQty.toLocaleString()} Total Bales</span>
                  </div>
                  <div className="bg-white border border-slate-200 p-2 text-center rounded shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Active Utilization</span>
                    <span className="text-lg font-black text-sky-700">
                      {activeGdnCapacityMT > 0 ? (((gwtTotalWeight / 10) / activeGdnCapacityMT) * 100).toFixed(1) : "0.0"}%
                    </span>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-sky-600 h-full rounded-full" 
                        style={{ width: `${Math.min(100, activeGdnCapacityMT > 0 ? ((gwtTotalWeight / 10) / activeGdnCapacityMT) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 p-2 text-center rounded shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Absolute Master Cap</span>
                    <span className="text-lg font-black text-indigo-900">{totalCapSum.toLocaleString()} MT</span>
                    <span className="text-[8px] text-slate-400 block mt-0.5 font-extrabold">All {DEFAULT_GODOWNS.length} Registered Godowns</span>
                  </div>
                </div>

                {/* Modal Search Bar filter */}
                <div className="flex items-center gap-2 bg-[#d4d0c8] p-1.5 border border-black/20 shadow-xs">
                  <span className="text-[10px] font-black text-slate-700 uppercase shrink-0">Search Godowns:</span>
                  <div className="relative flex-1">
                    <input  id="type_godown_name_code_or__3124" name="type_godown_name_code_or_" aria-label="Type Godown Name, Code, or Material Grade (e.g. M.BOT)..."
                      type="text" 
                      placeholder="Type Godown Name, Code, or Material Grade (e.g. M.BOT)..." 
                      value={popupSearchQuery}
                      onChange={(e) => setPopupSearchQuery(e.target.value)}
                      className="w-full h-7 bg-white border border-slate-400 px-2 pl-7 text-[10px] font-black focus:outline-hidden text-slate-800 rounded-sm"
                    />
                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-500" />
                  </div>
                  {popupSearchQuery && (
                    <button 
                      type="button" 
                      onClick={() => setPopupSearchQuery("")}
                      className="bg-white border border-slate-300 hover:bg-slate-100 text-[10px] font-black text-slate-600 px-2 h-7 rounded shadow-xs cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Godown Table */}
                <div className="border border-slate-200 overflow-x-auto rounded-md shadow-xs animate-in fade-in duration-200">
                  <table className="w-full text-left text-[10px] font-black text-slate-700 min-w-[600px] border-collapse">
                    <thead>
                      <tr className="bg-[#e4e0d8] border-b border-slate-300 text-slate-950 uppercase text-[9px] tracking-tight">
                        <th className="p-2.5 border-r border-slate-300">Godown Name</th>
                        <th className="p-2.5 border-r border-slate-300 text-center">Status</th>
                        <th className="p-2.5 border-r border-slate-300 text-right">Capacity (MT)</th>
                        <th className="p-2.5 border-r border-slate-300 text-right">Stored Stock (MT)</th>
                        <th className="p-2.5 border-r border-slate-300">Capacity Utilization</th>
                        <th className="p-2.5">Grades Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredGdNodes.length > 0 ? (
                        filteredGdNodes.map((node) => {
                          let badgeColor = "bg-slate-100 text-slate-600 border-slate-200";
                          let progressColor = "bg-emerald-600";
                          if (node.isActive) {
                            badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-250 font-extrabold shadow-xs";
                          }
                          if (node.utilPercent > 75) {
                            progressColor = "bg-amber-600";
                          } 
                          if (node.utilPercent > 90) {
                            progressColor = "bg-rose-600";
                          }

                          return (
                            <tr key={node.name} className={cn("hover:bg-slate-50", node.isActive ? "bg-emerald-50/10" : "")}>
                              <td className="p-2.5 border-r border-slate-200 text-slate-950 font-extrabold flex items-center gap-1.5">
                                <Box className="h-3 w-3 text-indigo-950" />
                                Godown {node.name}
                              </td>
                              <td className="p-2.5 border-r border-slate-200 text-center">
                                <span className={cn("inline-block text-[8px] tracking-wide uppercase px-1.5 py-0.5 rounded border font-black", badgeColor)}>
                                  {node.isActive ? "● Active" : "○ Inactive"}
                                </span>
                              </td>
                              <td className="p-2.5 border-r border-slate-200 text-right text-slate-900 font-mono">
                                {node.capacity} MT
                              </td>
                              <td className="p-2.5 border-r border-slate-200 text-right text-slate-950 font-mono font-black">
                                {node.storedWeight.toFixed(2)} MT
                              </td>
                              <td className="p-2.5 border-r border-slate-200 text-slate-900">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-100 h-2 rounded overflow-hidden shadow-inner border border-slate-200">
                                    <div 
                                      className={cn("h-full rounded transition-all duration-300", progressColor)}
                                      style={{ width: `${node.utilPercent}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[9px] font-extrabold text-slate-800">
                                    {node.utilPercent.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td className="p-2.5 text-stone-650 font-sans italic max-w-[200px] truncate" title={node.gradeBreakdown}>
                                {node.gradeBreakdown}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 italic">No godowns match the search criteria.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Popup action strip bar */}
              <div className="bg-[#d4d0c8] py-2 px-4 border-t border-white/60 flex justify-end ">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCapacityPopup(false);
                    setPopupSearchQuery("");
                  }}
                  className="bg-white border-2 border-slate-400 shadow-[1px_1px_0_black] font-black text-[10px] text-slate-800 uppercase px-6 py-1 cursor-pointer active:translate-y-px"
                >
                  Done View
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </LegacyLayout>
  );
}

function StockMetric({ 
  label, 
  bales, 
  weight, 
  type,
  subText 
}: { 
  label: string; 
  bales: number; 
  weight: number; 
  type: 'bales' | 'sold' | 'weight' | 'stock';
  subText?: string;
}) {
  // Setup theme-specific styling to make each card look wonderfully distinct in size, color, typography & styling!
  const theme = 
    type === 'bales' ? {
      headerBg: 'bg-gradient-to-r from-blue-800 to-indigo-800 border-b border-indigo-900',
      iconBg: 'bg-indigo-950/40 text-blue-100',
      cardBg: 'bg-gradient-to-br from-[#f0f4ff] to-[#e6edff] border-blue-300',
      textMain: 'text-blue-900',
      textSec: 'text-indigo-800/80',
      badgeBg: 'bg-blue-100 text-blue-800',
      shadow: 'shadow-[3px_3px_0_0_#000080]'
    } :
    type === 'sold' ? {
      headerBg: 'bg-gradient-to-r from-emerald-800 to-teal-800 border-b border-emerald-900',
      iconBg: 'bg-emerald-950/40 text-emerald-100',
      cardBg: 'bg-gradient-to-br from-[#edfcf2] to-[#e1f9eb] border-emerald-300',
      textMain: 'text-emerald-950',
      textSec: 'text-teal-800/80',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      shadow: 'shadow-[3px_3px_0_0_#0f5132]'
    } :
    type === 'weight' ? {
      headerBg: 'bg-gradient-to-r from-rose-800 to-amber-800 border-b border-rose-900',
      iconBg: 'bg-rose-950/40 text-rose-100',
      cardBg: 'bg-gradient-to-br from-[#fff1f2] to-[#ffe4e6] border-rose-300',
      textMain: 'text-rose-950',
      textSec: 'text-amber-800/80',
      badgeBg: 'bg-rose-100 text-rose-800',
      shadow: 'shadow-[3px_3px_0_0_#842029]'
    } : {
      // type === 'stock'
      headerBg: 'bg-gradient-to-r from-purple-800 to-violet-800 border-b border-purple-900',
      iconBg: 'bg-purple-950/40 text-purple-100',
      cardBg: 'bg-gradient-to-br from-[#faf5ff] to-[#f3e8ff] border-purple-300',
      textMain: 'text-purple-950',
      textSec: 'text-violet-800/80',
      badgeBg: 'bg-purple-100 text-purple-800',
      shadow: 'shadow-[3px_3px_0_0_#581c87]'
    };

  return (
    <div className={cn("border-2 p-0.5 rounded transition-transform hover:-translate-y-0.5 duration-200 bg-[#d4d0c8]", theme.cardBg, theme.shadow)}>
       {/* Card header with icon and name */}
       <div className={cn("h-7 flex items-center px-2 gap-2 text-white font-mono rounded-t-sm ", theme.headerBg)}>
          <div className={cn("p-0.5 rounded flex items-center justify-center", theme.iconBg)}>
            {type === 'bales' && <Box className="h-3.5 w-3.5" />}
            {type === 'weight' && <Scale className="h-3.5 w-3.5" />}
            {type === 'sold' && <TrendingUp className="h-3.5 w-3.5" />}
            {type === 'stock' && <Archive className="h-3.5 w-3.5" />}
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
       </div>
       
       {/* Card contents - Dual Metrics Grid Layout */}
       <div className="p-3.5 flex flex-col gap-2 border-t border-slate-300">
          <div className="grid grid-cols-2 gap-2 items-center divide-x divide-slate-300/60">
             {/* Metric 1: Bales */}
             <div className="pr-2">
                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Quantity</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                   <span className={cn("text-2xl font-extrabold tabular-nums tracking-tighter leading-none", theme.textMain)}>
                      {bales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                   </span>
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider italic">Bales</span>
                </div>
             </div>
             
             {/* Metric 2: Quintals */}
             <div className="pl-3">
                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Weight</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                   <span className={cn("text-lg font-black tabular-nums tracking-tight leading-none", theme.textSec)}>
                      {(weight / 10).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </span>
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider italic">MT</span>
                </div>
             </div>
          </div>
          
          {/* Progress bar or dynamic badge context */}
          <div className="flex flex-col gap-1 border-t border-slate-200/50 pt-1.5 mt-0.5">
             <div className="flex items-center justify-between text-[8px] font-bold text-slate-500">
                <span>SYSTEM LEDGER VALUE</span>
                <span className={cn("px-1.5 py-px rounded font-black text-[7px] uppercase tracking-wider", theme.badgeBg)}>
                   {type === 'bales' ? 'Baseline Opening' : 
                    type === 'sold' ? 'Mill Raw Jute In' : 
                    type === 'weight' ? 'Material Out' : 'Net Active Stock'}
                </span>
             </div>
             {subText && (
                <span className="text-[8px] font-mono font-bold tracking-tight text-slate-500 text-left block bg-slate-200/50 px-1 py-0.5 rounded-xs border border-slate-300/40">
                  ⚡ {subText}
                </span>
             )}
          </div>
       </div>
    </div>
  );
}

function StockItemRow({ name, opening, incoming, outgoing, balance, weight }: any) {
  return (
     <tr className="h-8 border-b border-gray-100 hover:bg-[#ffffd0]/50 transition-colors">
        <td className="px-6 text-gray-600 uppercase tracking-tight font-extrabold">{name}</td>
        <td className="px-4 text-center tabular-nums text-green-700 bg-green-50/10 font-mono font-bold">{opening}</td>
        <td className="px-4 text-center tabular-nums text-indigo-700 bg-indigo-50/10 font-mono font-bold">{incoming}</td>
        <td className="px-4 text-center tabular-nums text-red-700 bg-red-50/5 font-mono font-bold">{outgoing}</td>
        <td className="px-4 text-center tabular-nums font-black text-blue-900 bg-blue-50/5 font-mono">{balance}</td>
        <td className="px-6 text-right tabular-nums italic text-slate-800 font-mono font-black">{weight}</td>
     </tr>
  )
}

function Scale({ className }: any) {
   return <div className={cn("border border-white/50 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black leading-none", className)}>⚖</div>
}
