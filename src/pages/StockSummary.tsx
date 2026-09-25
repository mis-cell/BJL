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
  AreaChart,
  Area,
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
import { PaginationControls } from '../components/PaginationControls';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import MaterialIssue from './MaterialIssue';
import PrintModal from '../components/PrintModal';
import { 
  FALLBACK_GODOWNS, 
  FALLBACK_GRADES, 
  FALLBACK_AREAS, 
  FALLBACK_UNITS, 
  DEFAULT_GODOWNS 
} from '../utils/stockSummaryConstants';
import { 
  StockMetric, 
  StockSparkline, 
  StockItemRow, 
  Scale 
} from '../components/stock-summary/StockSummaryMetrics';
import {
  StockFormModal,
  StockOpeningPrintModal,
  StockClosingPrintModal,
  StockCapacityAuditModal,
  StockTransferModal,
  StockUpdateGodownModal,
  StockPdfSummaryModal
} from '../components/stock-summary/StockSummaryModals';

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
  const [OpenStock, setOpenStock] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>({});
  const [treeHierarchyMode, setTreeHierarchyMode] = useState<'area_grade' | 'grade_area'>('area_grade');
  const [expandedGradesTop, setExpandedGradesTop] = useState<Record<string, boolean>>({});
  const [expandedAreasSub, setExpandedAreasSub] = useState<Record<string, boolean>>({});
  const [expandedLiveGrades, setExpandedLiveGrades] = useState<Record<string, boolean>>({});

  // Multi-filters & Quick actions state
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('ALL');
  const [selectedGodownFilter, setSelectedGodownFilter] = useState('ALL');
  const [transferRecord, setTransferRecord] = useState<any | null>(null);
  const [transferTargetGodown, setTransferTargetGodown] = useState('');
  const [transferBales, setTransferBales] = useState('');
  const [updateGodownRecord, setUpdateGodownRecord] = useState<any | null>(null);
  const [newGodownName, setNewGodownName] = useState('');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

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

  // 100-rows per page pagination
  const [closingCurrentPage, setClosingCurrentPage] = useState(1);
  const [closingPageSize, setClosingPageSize] = useState(100);
  const [liveCurrentPage, setLiveCurrentPage] = useState(1);
  const [livePageSize, setLivePageSize] = useState(100);

  useEffect(() => {
    setClosingCurrentPage(1);
    setLiveCurrentPage(1);
  }, [searchQuery, selectedGodownFilter, selectedGradeFilter, selectedAreaFilter, startDateFilter, endDateFilter]);

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

  const handleExecuteTransfer = async () => {
    if (!transferRecord || !transferTargetGodown || !transferBales) {
      alert("Please select target godown and enter valid bales to transfer.");
      return;
    }
    const qtyToTransfer = parseInt(transferBales) || 0;
    if (qtyToTransfer <= 0 || qtyToTransfer > Number(transferRecord.quantity || 0)) {
      alert("Invalid quantity to transfer.");
      return;
    }

    try {
      const newRecord = {
        ...transferRecord,
        id: `transfer-${Date.now()}`,
        godown: transferTargetGodown,
        quantity: qtyToTransfer,
        weight: (Number(transferRecord.weight || 0) * (qtyToTransfer / Number(transferRecord.quantity || 1))),
        opening_date: new Date().toISOString().split('T')[0]
      };

      const updatedSourceQty = Number(transferRecord.quantity || 0) - qtyToTransfer;
      const updatedSourceWt = Number(transferRecord.weight || 0) * (updatedSourceQty / Number(transferRecord.quantity || 1));

      if (supabase) {
        await supabase.from('opening_stock').update({ quantity: updatedSourceQty, weight: updatedSourceWt }).eq('id', transferRecord.id);
        await supabase.from('godown_wise_stock').update({ quantity: updatedSourceQty, weight: updatedSourceWt }).eq('id', transferRecord.id);
        await supabase.from('opening_stock').insert({
          opening_date: newRecord.opening_date,
          godown: newRecord.godown,
          area: newRecord.area,
          grade: newRecord.grade,
          jci: newRecord.jci || 'No',
          unit: newRecord.unit || 'BALES',
          quantity: newRecord.quantity,
          weight: newRecord.weight
        });
      }

      await loadOpeningStocks();
      alert(`Success: Transferred ${qtyToTransfer} bales to godown ${transferTargetGodown}!`);
      setTransferRecord(null);
      setTransferBales('');
      setTransferTargetGodown('');
    } catch (err) {
      console.error("Transfer failed:", err);
      alert("Error executing stock transfer.");
    }
  };

  const handleExecuteUpdateGodown = async () => {
    if (!updateGodownRecord || !newGodownName) {
      alert("Please select a new godown name.");
      return;
    }

    try {
      if (supabase) {
        await supabase.from('opening_stock').update({ godown: newGodownName }).eq('id', updateGodownRecord.id);
        await supabase.from('godown_wise_stock').update({ godown: newGodownName }).eq('id', updateGodownRecord.id);
      }
      await loadOpeningStocks();
      alert(`Success: Godown updated to ${newGodownName} successfully!`);
      setUpdateGodownRecord(null);
      setNewGodownName('');
    } catch (err) {
      console.error("Update godown failed:", err);
      alert("Error updating godown location.");
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
  
          {/* Opening Stock */}
          <div className="relative bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />

            <div className="flex items-center justify-between gap-2 pl-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">
                  Total Opening Stock
                </p>

                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-slate-800">
                    {totalOpeningQty}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-slate-400">
                    Bales
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase">
                  Weight
                </p>
                <p className="text-sm font-black text-blue-700">
                  {totalOpeningWt?.toFixed(3)}
                </p>
                <span className="text-[8px] font-bold text-slate-400">
                  M.T.
                </span>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-100">
              <span className="text-[8px] font-semibold text-slate-400">
                {getOpeningStockDateInfo()}
              </span>
            </div>
          </div>


          {/* Issued to Godown */}
          <div className="relative bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600" />

            <div className="flex items-center justify-between gap-2 pl-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">
                  Issued to Godown (+)
                </p>

                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-slate-800">
                    {totalIssuedToGodownBales}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-slate-400">
                    Bales
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase">
                  Weight
                </p>
                <p className="text-sm font-black text-emerald-700">
                  {totalIssuedToGodownWeight?.toFixed(3)}
                </p>
                <span className="text-[8px] font-bold text-slate-400">
                  M.T.
                </span>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-100">
              <span className="text-[8px] font-semibold text-slate-400">
                {getIssuedToGodownDateInfo()}
              </span>
            </div>
          </div>


          {/* Godown to Factory */}
          <div className="relative bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />

            <div className="flex items-center justify-between gap-2 pl-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">
                  Godown to Factory (-)
                </p>

                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-slate-800">
                    {totalIssuedToFactoryBales}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-slate-400">
                    Bales
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase">
                  Weight
                </p>
                <p className="text-sm font-black text-amber-700">
                  {totalIssuedToFactoryWeight?.toFixed(3)}
                </p>
                <span className="text-[8px] font-bold text-slate-400">
                  M.T.
                </span>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-100">
              <span className="text-[8px] font-semibold text-slate-400">
                {getIssuedToFactoryDateInfo()}
              </span>
            </div>
          </div>


          {/* Current Stock */}
          <div className="relative bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400" />

            <div className="flex items-center justify-between gap-2 pl-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 truncate">
                  Current Stock Balance
                </p>

                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-white">
                    {currentClosingStockBales}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-slate-400">
                    Bales
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold text-slate-500 uppercase">
                  Weight
                </p>
                <p className="text-sm font-black text-cyan-400">
                  {currentClosingStockWeight?.toFixed(3)}
                </p>
                <span className="text-[8px] font-bold text-slate-500">
                  M.T.
                </span>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-white/10">
              <span className="text-[8px] font-semibold text-slate-500">
                {getCurrentStockBalanceDateInfo()}
              </span>
            </div>
          </div>

        </div>

        {/* Windows Classic Tab Selectors & Integrated Period Controls */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* Main Navigation */}
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">

            {/* Left Navigation Area */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Opening Stock */}
              <button
                onClick={() => setActiveTab('opening')}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border px-4 py-2 text-[11px] font-black uppercase tracking-wide transition-all duration-200 cursor-pointer",
                  activeTab === 'opening'
                    ? "border-[#1c4587] bg-[#1c4587] text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#1c4587]/40 hover:bg-blue-50 hover:text-[#1c4587]"
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 text-sm">
                  📋
                </span>
                <span>Stock Inventory</span>
              </button>

              {/* Live Inventory */}
              <button
                onClick={() => setActiveTab('live')}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border px-4 py-2 text-[11px] font-black uppercase tracking-wide transition-all duration-200 cursor-pointer",
                  activeTab === 'live'
                    ? "border-[#0b6e54] bg-[#0b6e54] text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#0b6e54]/40 hover:bg-emerald-50 hover:text-[#0b6e54]"
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 text-sm">
                  📉
                </span>
                <span>Live Inventory</span>
              </button>

              {/* Opening Sub Tabs */}
              {activeTab === 'opening' && (
                <div className="flex flex-wrap items-center gap-1 border-l border-slate-200 pl-2">

                  {/* Godown Wise Stock */}
                  <button
                    onClick={() => setStockSubTab('opening')}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-bold uppercase transition-all cursor-pointer",
                      stockSubTab === 'opening'
                        ? "bg-blue-50 text-[#1c4587] ring-1 ring-[#1c4587]/20 shadow-sm"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    )}
                  >
                    <span>📦</span>
                    <span>Godown Stocks</span>
                  </button>

                  {/* Monthly Opening Stock */}
                  <button
                    onClick={() => setStockSubTab('closing')}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-bold uppercase transition-all cursor-pointer",
                      stockSubTab === 'closing'
                        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200 shadow-sm"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    )}
                  >
                    <span>🔴</span>
                    <span>Monthly Opening Stock</span>
                  </button>

                </div>
              )}
            </div>

            {/* Right Controls */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 lg:ml-auto">

              {/* Stock Period */}
              <div className="flex items-center gap-2 border-r border-slate-200 pr-2">

                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-xs">
                  📅
                </div>

                <div className="flex flex-col leading-tight">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                    Stock Period
                  </span>

                  {startDateFilter || endDateFilter ? (
                    <div className="flex items-center gap-1.5">

                      <span className="flex items-center gap-1 rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[9px] font-black text-[#1c4587] shadow-xs">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />

                        {startDateFilter
                          ? formatDateBeautiful(startDateFilter)
                          : 'Start'}

                        <span className="text-slate-400">→</span>

                        {endDateFilter
                          ? formatDateBeautiful(endDateFilter)
                          : 'End'}
                      </span>

                      <button
                        onClick={() => {
                          setStartDateFilter('');
                          setEndDateFilter('');
                        }}
                        className="rounded border border-rose-200 bg-white px-1.5 py-0.5 text-[8px] font-black uppercase text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
                        title="Clear date filter"
                      >
                        Reset
                      </button>

                    </div>
                  ) : (
                    <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                      ALL HISTORY
                    </span>
                  )}
                </div>

              </div>

              {/* Calculation Mode */}
              <div className="flex items-center gap-2">

                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-xs">
                  📊
                </div>

                <div className="flex flex-col leading-tight">
                  <span className="mb-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                    Calculation Mode
                  </span>

                  <div className="inline-flex w-fit rounded-md border border-slate-200 bg-white p-0.5 shadow-xs">

                    {/* As Of */}
                    <button
                      onClick={() => setMetricCalculationMode('cumulative')}
                      className={cn(
                        "flex items-center gap-1 rounded px-2 py-1 text-[9px] font-black uppercase transition-all cursor-pointer",
                        metricCalculationMode === 'cumulative'
                          ? "bg-[#1c4587] text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      )}
                      title="True cumulative stock balance as of end period"
                    >
                      📈
                      <span>As-Of</span>
                    </button>

                    {/* Period Activity */}
                    <button
                      onClick={() => setMetricCalculationMode('period')}
                      className={cn(
                        "flex items-center gap-1 rounded px-2 py-1 text-[9px] font-black uppercase transition-all cursor-pointer",
                        metricCalculationMode === 'period'
                          ? "bg-[#0b6e54] text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      )}
                      title="Only activity/transactions occurred inside selected period"
                    >
                      📊
                      <span>Period Activity</span>
                    </button>

                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

        {activeTab === 'opening' ? (
          /* Tab 1: Latest Stock Ledgers (Opening / Closing Switcher without cramped sidebar) */
          <div className="space-y-3">         
            {/* Action options (2nd Screenshot Options) */}
            <>
              <div className="flex items-center gap-2 w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 shadow-sm">

                {/* New Record */}
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
                  className="h-8 px-3.5 bg-[#174C2C] hover:bg-[#103A20] text-white rounded-md text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  {stockSubTab === 'opening' ? 'New Opening Record' : 'New Monthly Record'}
                </button>

                {/* Export */}
                <button
                  onClick={handleExportToCSV}
                  title="Download active ledger records as CSV format"
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Export CSV
                </button>

                {/* Print */}
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
                        alert("Please select a Monthly Stock row first.");
                      }
                    }
                  }}
                  className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  Print Slip
                </button>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-200 mx-0.5" />

                {/* Search */}
                <div className="flex items-center flex-1 min-w-0 h-8 bg-slate-50 border border-slate-300 rounded-md overflow-hidden focus-within:border-[#174C2C] focus-within:ring-1 focus-within:ring-[#174C2C]/20 transition-all">

                  <div className="flex items-center justify-center w-8 h-full bg-slate-100 border-r border-slate-200 shrink-0">
                    <Search className="h-3.5 w-3.5 text-slate-500" />
                  </div>

                  <input
                    id="searchquery_1518"
                    name="searchquery"
                    aria-label="searchquery"
                    className="flex-1 min-w-0 h-full bg-transparent px-2.5 text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                    placeholder={stockSubTab === 'opening' ? "Search opening ledger latest stock (e.g. Forbesganj, TD-5, Godown)..." : "Search monthly closing ledger latest stock (e.g. Rate, Bales, Variety, Remarks)..." }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="h-full px-2 text-[9px] font-extrabold uppercase text-red-600 hover:bg-red-50 border-l border-slate-200 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Reload */}
                <button
                  onClick={
                    stockSubTab === 'opening'
                      ? loadOpeningStocks
                      : loadClosingStocks
                  }
                  className="h-8 px-3 bg-slate-700 hover:bg-slate-800 text-white rounded-md text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  title="Reload records"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload
                </button>

              </div>
            </>

            {/* Area-Wise / Grade-Wise Simple Stock Display Tree */}
            {stockSubTab === 'opening' ? (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden p-4 space-y-3">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-3 border-b border-slate-200 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-[#174C2C] text-white flex items-center justify-center font-black text-xs">
                      {treeHierarchyMode === 'area_grade' ? '📍' : '🏷️'}
                    </span>
                    <div>
                      <h3 className="text-xs font-black uppercase text-indigo-950">
                        {treeHierarchyMode === 'area_grade' 
                          ? 'Area Wise & Grade Wise Stock Inventory (Godown Breakdown)' 
                          : 'Grade Wise & Area Wise Stock Inventory (Godown Breakdown)'}
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        {treeHierarchyMode === 'area_grade' 
                          ? 'Click on [+] to expand Area, then Grade to view Godowns' 
                          : 'Click on [+] to expand Grade, then Area to view Godowns'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setTreeHierarchyMode('area_grade')}
                        className={cn(
                          "px-2.5 py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer",
                          treeHierarchyMode === 'area_grade' ? "bg-[#174C2C] text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        📍 Area → Grade
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreeHierarchyMode('grade_area')}
                        className={cn(
                          "px-2.5 py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer",
                          treeHierarchyMode === 'grade_area' ? "bg-[#174C2C] text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        🏷️ Grade → Area
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        if (treeHierarchyMode === 'area_grade') {
                          const allAreas: Record<string, boolean> = {};
                          const allGrades: Record<string, boolean> = {};
                          filteredSavedStocks.forEach(r => {
                            const area = (r.area || 'UNASSIGNED').toUpperCase();
                            const grade = (r.grade || 'UNASSIGNED').toUpperCase();
                            allAreas[area] = true;
                            allGrades[`${area}__${grade}`] = true;
                          });
                          setExpandedAreas(allAreas);
                          setExpandedGrades(allGrades);
                        } else {
                          const allGradesTop: Record<string, boolean> = {};
                          const allAreasSub: Record<string, boolean> = {};
                          filteredSavedStocks.forEach(r => {
                            const grade = (r.grade || 'UNASSIGNED').toUpperCase();
                            const area = (r.area || 'UNASSIGNED').toUpperCase();
                            allGradesTop[grade] = true;
                            allAreasSub[`${grade}__${area}`] = true;
                          });
                          setExpandedGradesTop(allGradesTop);
                          setExpandedAreasSub(allAreasSub);
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-black uppercase cursor-pointer transition-colors"
                    >
                      Expand All
                    </button>
                    <button 
                      onClick={() => {
                        if (treeHierarchyMode === 'area_grade') {
                          setExpandedAreas({});
                          setExpandedGrades({});
                        } else {
                          setExpandedGradesTop({});
                          setExpandedAreasSub({});
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-black uppercase cursor-pointer transition-colors"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {filteredSavedStocks.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs font-bold uppercase">
                    No stock inventory records found. Click "New Opening Record" above to add stock.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {treeHierarchyMode === 'area_grade' ? (() => {
                      const tree: Record<string, Record<string, any[]>> = {};
                      filteredSavedStocks.forEach(r => {
                        const area = (r.area || 'GENERAL AREA').toUpperCase();
                        const grade = (r.grade || 'GENERAL GRADE').toUpperCase();
                        if (!tree[area]) tree[area] = {};
                        if (!tree[area][grade]) tree[area][grade] = [];
                        tree[area][grade].push(r);
                      });

                      return Object.entries(tree).map(([area, gradesMap]) => {
                        const isAreaExpanded = !!expandedAreas[area];
                        const areaTotalQty = Object.values(gradesMap).reduce((sum, records) => sum + records.reduce((s, r) => s + (Number(r.quantity) || 0), 0), 0);
                        const areaTotalWt = Object.values(gradesMap).reduce((sum, records) => sum + records.reduce((s, r) => s + (Number(r.weight) || 0), 0), 0);

                        return (
                          <div key={area} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                            {/* Area Header Row */}
                            <div 
                              onClick={() => setExpandedAreas(prev => ({ ...prev, [area]: !prev[area] }))}
                              className="flex items-center justify-between px-3.5 py-3 bg-slate-50 hover:bg-slate-100 cursor-pointer select-none transition-colors border-b border-slate-200"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 rounded bg-[#174C2C] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                                  {isAreaExpanded ? '-' : '+'}
                                </span>
                                <span className="text-xs font-black uppercase text-indigo-950 tracking-wide">
                                  📍 Area: {area}
                                </span>
                                <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  {Object.keys(gradesMap).length} Grades
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-mono font-black text-slate-800">
                                <span>Total Qty: <span className="text-indigo-950">{areaTotalQty.toLocaleString()} Bales</span></span>
                                <span>Total Wt: <span className="text-teal-700">{(areaTotalWt * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG</span></span>
                              </div>
                            </div>

                            {/* Grades under Area */}
                            {isAreaExpanded && (
                              <div className="p-3 space-y-2 bg-slate-50/60">
                                {Object.entries(gradesMap).map(([grade, records]) => {
                                  const gradeKey = `${area}__${grade}`;
                                  const isGradeExpanded = !!expandedGrades[gradeKey];
                                  const gradeTotalQty = records.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
                                  const gradeTotalWt = records.reduce((s, r) => s + (Number(r.weight) || 0), 0);

                                  return (
                                    <div key={grade} className="border border-indigo-100 rounded-md overflow-hidden bg-white ml-4 shadow-xs">
                                      {/* Grade Header Row */}
                                      <div 
                                        onClick={() => setExpandedGrades(prev => ({ ...prev, [gradeKey]: !prev[gradeKey] }))}
                                        className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 hover:bg-indigo-100/60 cursor-pointer select-none transition-colors border-b border-indigo-100"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-4 h-4 rounded bg-indigo-700 text-white flex items-center justify-center font-black text-[10px] shrink-0">
                                            {isGradeExpanded ? '-' : '+'}
                                          </span>
                                          <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wide">
                                            🏷️ Grade: {grade}
                                          </span>
                                          <span className="text-[8px] font-bold text-indigo-700 bg-white border border-indigo-200 px-1.5 py-0.5 rounded">
                                            {records.length} Godowns
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] font-mono font-black text-slate-800">
                                          <span>Qty: <span className="text-indigo-950">{gradeTotalQty.toLocaleString()}</span></span>
                                          <span>Wt: <span className="text-teal-700">{(gradeTotalWt * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG</span></span>
                                        </div>
                                      </div>

                                      {/* Godowns & Stock Records under Grade */}
                                      {isGradeExpanded && (
                                        <div className="p-2 space-y-1.5 bg-white ml-4">
                                          <div className="text-[9px] font-black uppercase text-slate-400 px-2 pb-1 border-b border-slate-100 grid grid-cols-12 gap-2">
                                            <span className="col-span-3">Godown / Warehouse</span>
                                            <span className="col-span-2">Date</span>
                                            <span className="col-span-2 text-center">JCI</span>
                                            <span className="col-span-2 text-right">Quantity</span>
                                            <span className="col-span-2 text-right">Weight (KG)</span>
                                            <span className="col-span-1 text-center">Action</span>
                                          </div>
                                          {records.map((r, ri) => (
                                            <div 
                                              key={r.id || ri}
                                              onClick={() => setSelectedStockId(r.id || null)}
                                              className={cn(
                                                "grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                                                selectedStockId === r.id ? "bg-indigo-950 text-white" : "hover:bg-slate-100 text-slate-800"
                                              )}
                                            >
                                              <span className="col-span-3 font-black uppercase truncate flex items-center gap-1.5">
                                                <span>📦</span> {r.godown || '-'}
                                              </span>
                                              <span className="col-span-2 font-mono text-slate-500">
                                                {r.opening_date || '-'}
                                              </span>
                                              <span className="col-span-2 text-center">
                                                <span className={cn(
                                                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                                                  (r.jci || '').toUpperCase() === 'YES' ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                                                )}>
                                                  {r.jci || 'No'}
                                                </span>
                                              </span>
                                              <span className="col-span-2 text-right font-mono font-black text-indigo-900">
                                                {r.quantity || 0} Bales
                                              </span>
                                              <span className="col-span-2 text-right font-mono font-black text-teal-700">
                                                {(Number(r.weight || 0) * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
                                              </span>
                                              <span className="col-span-1 flex items-center justify-center gap-1">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
                                                  className="p-1 hover:bg-blue-100 rounded text-blue-700 cursor-pointer"
                                                  title="Edit Record"
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </button>
                                                <button
                                                  onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (canDeleteData() && confirm("Are you sure you want to delete this opening stock record?")) {
                                                      handleDelete(r.id, `${r.grade} @ ${r.godown}`);
                                                    }
                                                  }}
                                                  className="p-1 hover:bg-red-100 rounded text-red-600 cursor-pointer"
                                                  title="Delete Record"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })() : (() => {
                      const tree: Record<string, Record<string, any[]>> = {};
                      filteredSavedStocks.forEach(r => {
                        const grade = (r.grade || 'GENERAL GRADE').toUpperCase();
                        const area = (r.area || 'GENERAL AREA').toUpperCase();
                        if (!tree[grade]) tree[grade] = {};
                        if (!tree[grade][area]) tree[grade][area] = [];
                        tree[grade][area].push(r);
                      });

                      return Object.entries(tree).map(([grade, areasMap]) => {
                        const isGradeExpanded = !!expandedGradesTop[grade];
                        const gradeTotalQty = Object.values(areasMap).reduce((sum, records) => sum + records.reduce((s, r) => s + (Number(r.quantity) || 0), 0), 0);
                        const gradeTotalWt = Object.values(areasMap).reduce((sum, records) => sum + records.reduce((s, r) => s + (Number(r.weight) || 0), 0), 0);

                        return (
                          <div key={grade} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                            {/* Grade Header Row */}
                            <div 
                              onClick={() => setExpandedGradesTop(prev => ({ ...prev, [grade]: !prev[grade] }))}
                              className="flex items-center justify-between px-3.5 py-3 bg-slate-50 hover:bg-slate-100 cursor-pointer select-none transition-colors border-b border-slate-200"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 rounded bg-[#174C2C] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                                  {isGradeExpanded ? '-' : '+'}
                                </span>
                                <span className="text-xs font-black uppercase text-indigo-950 tracking-wide">
                                  🏷️ Grade: {grade}
                                </span>
                                <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  {Object.keys(areasMap).length} Areas
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-mono font-black text-slate-800">
                                <span>Total Qty: <span className="text-indigo-950">{gradeTotalQty.toLocaleString()} Bales</span></span>
                                <span>Total Wt: <span className="text-teal-700">{(gradeTotalWt * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG</span></span>
                              </div>
                            </div>

                            {/* Areas under Grade */}
                            {isGradeExpanded && (
                              <div className="p-3 space-y-2 bg-slate-50/60">
                                {Object.entries(areasMap).map(([area, records]) => {
                                  const areaKey = `${grade}__${area}`;
                                  const isAreaExpanded = !!expandedAreasSub[areaKey];
                                  const areaTotalQty = records.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
                                  const areaTotalWt = records.reduce((s, r) => s + (Number(r.weight) || 0), 0);

                                  return (
                                    <div key={area} className="border border-indigo-100 rounded-md overflow-hidden bg-white ml-4 shadow-xs">
                                      {/* Area Header Row */}
                                      <div 
                                        onClick={() => setExpandedAreasSub(prev => ({ ...prev, [areaKey]: !prev[areaKey] }))}
                                        className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 hover:bg-indigo-100/60 cursor-pointer select-none transition-colors border-b border-indigo-100"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-4 h-4 rounded bg-indigo-700 text-white flex items-center justify-center font-black text-[10px] shrink-0">
                                            {isAreaExpanded ? '-' : '+'}
                                          </span>
                                          <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wide">
                                            📍 Area: {area}
                                          </span>
                                          <span className="text-[8px] font-bold text-indigo-700 bg-white border border-indigo-200 px-1.5 py-0.5 rounded">
                                            {records.length} Godowns
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] font-mono font-black text-slate-800">
                                          <span>Qty: <span className="text-indigo-950">{areaTotalQty.toLocaleString()}</span></span>
                                          <span>Wt: <span className="text-teal-700">{(areaTotalWt * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG</span></span>
                                        </div>
                                      </div>

                                      {/* Godowns & Stock Records under Area */}
                                      {isAreaExpanded && (
                                        <div className="p-2 space-y-1.5 bg-white ml-4">
                                          <div className="text-[9px] font-black uppercase text-slate-400 px-2 pb-1 border-b border-slate-100 grid grid-cols-12 gap-2">
                                            <span className="col-span-3">Godown / Warehouse</span>
                                            <span className="col-span-2">Date</span>
                                            <span className="col-span-2 text-center">JCI</span>
                                            <span className="col-span-2 text-right">Quantity</span>
                                            <span className="col-span-2 text-right">Weight (KG)</span>
                                            <span className="col-span-1 text-center">Action</span>
                                          </div>
                                          {records.map((r, ri) => (
                                            <div 
                                              key={r.id || ri}
                                              onClick={() => setSelectedStockId(r.id || null)}
                                              className={cn(
                                                "grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                                                selectedStockId === r.id ? "bg-indigo-950 text-white" : "hover:bg-slate-100 text-slate-800"
                                              )}
                                            >
                                              <span className="col-span-3 font-black uppercase truncate flex items-center gap-1.5">
                                                <span>📦</span> {r.godown || '-'}
                                              </span>
                                              <span className="col-span-2 font-mono text-slate-500">
                                                {r.opening_date || '-'}
                                              </span>
                                              <span className="col-span-2 text-center">
                                                <span className={cn(
                                                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                                                  (r.jci || '').toUpperCase() === 'YES' ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                                                )}>
                                                  {r.jci || 'No'}
                                                </span>
                                              </span>
                                              <span className="col-span-2 text-right font-mono font-black text-indigo-900">
                                                {r.quantity || 0} Bales
                                              </span>
                                              <span className="col-span-2 text-right font-mono font-black text-teal-700">
                                                {(Number(r.weight || 0) * 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
                                              </span>
                                              <span className="col-span-1 flex items-center justify-center gap-1">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
                                                  className="p-1 hover:bg-blue-100 rounded text-blue-700 cursor-pointer"
                                                  title="Edit Record"
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </button>
                                                <button
                                                  onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (canDeleteData() && confirm("Are you sure you want to delete this opening stock record?")) {
                                                      handleDelete(r.id, `${r.grade} @ ${r.godown}`);
                                                    }
                                                  }}
                                                  className="p-1 hover:bg-red-100 rounded text-red-600 cursor-pointer"
                                                  title="Delete Record"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            ) : (
              /* 15.2 Monthly Closing Stocks Ledger Grid layout */
              <div className="space-y-5 animate-in fade-in duration-100">

  {/* ========================================================= */}
  {/* 1. DATE WISE STOCK REPORT - FULL WIDTH SINGLE BLOCK */}
  {/* ========================================================= */}
  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">

    {/* Header */}
    <div className="bg-[#174C2C] px-4 py-2.5 flex items-center justify-between">

      <div className="flex items-center gap-2">

        <div className="h-7 w-7 rounded-md bg-white/10 border border-white/20 flex items-center justify-center">
          <Calendar className="h-3.5 w-3.5 text-white" />
        </div>

        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-white">
            Date Wise Stock Report
          </div>

          <div className="text-[8px] text-emerald-100 font-semibold">
            Monthly inventory summary
          </div>
        </div>

      </div>

      <span className="text-[8px] uppercase tracking-wider font-black text-white bg-white/10 border border-white/20 px-2 py-1 rounded">
        Latest Days
      </span>

    </div>


    {/* Date Report Table */}
    <div className="p-3">

      <div className="bg-slate-50 rounded-md border border-slate-200 overflow-hidden">

        <div className="max-h-[220px] overflow-y-auto">

          <table className="w-full text-left text-[9px] border-collapse font-mono">

            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 sticky top-0 font-black text-slate-500 uppercase">

                <th className="px-3 py-2 border-r border-slate-200">
                  Stock Date
                </th>

                <th className="px-3 py-2 text-center border-r border-slate-200">
                  Entries
                </th>

                <th className="px-3 py-2 text-right border-r border-slate-200">
                  Physical Bales
                </th>

                <th className="px-3 py-2 text-right border-r border-slate-200">
                  Weight (MT)
                </th>

                <th className="px-3 py-2 text-right">
                  Action
                </th>

              </tr>
            </thead>


            <tbody className="divide-y divide-slate-100">

              {dateWiseClosingList.map((rep) => {

                const isSelectedDate =
                  startDateFilter === rep.date &&
                  endDateFilter === rep.date;

                return (
                  <tr
                    key={rep.date}
                    onClick={() => {
                      setStartDateFilter(rep.date);
                      setEndDateFilter(rep.date);
                    }}
                    className={cn(
                      "cursor-pointer transition-colors h-9",
                      isSelectedDate
                        ? "bg-emerald-50"
                        : "bg-white hover:bg-slate-50"
                    )}
                  >

                    {/* Date */}
                    <td className="px-3 font-bold text-slate-700">

                      <div className="flex items-center gap-2">

                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full inline-block",
                            isSelectedDate
                              ? "bg-red-500 animate-pulse"
                              : "bg-[#174C2C]"
                          )}
                        />

                        {new Date(rep.date).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}

                      </div>

                    </td>


                    {/* Entries */}
                    <td className="px-3 text-center font-black text-slate-700 border-l border-slate-100">
                      {rep.count}
                    </td>


                    {/* Bales */}
                    <td className="px-3 text-right font-black text-[#174C2C] border-l border-slate-100">
                      {rep.quantity.toLocaleString()}
                    </td>


                    {/* Weight */}
                    <td className="px-3 text-right font-black text-emerald-700 border-l border-slate-100">
                      {(rep.weight / 10).toFixed(2)} MT
                    </td>


                    {/* Action */}
                    <td className="px-3 text-right border-l border-slate-100">

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStartDateFilter(rep.date);
                          setEndDateFilter(rep.date);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[8px] font-black uppercase transition-all cursor-pointer",
                          isSelectedDate
                            ? "bg-[#174C2C] text-white"
                            : "bg-emerald-50 text-[#174C2C] hover:bg-[#174C2C] hover:text-white"
                        )}
                      >
                        {isSelectedDate ? "Selected" : "View"}
                      </button>

                    </td>

                  </tr>
                );

              })}


              {dateWiseClosingList.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-slate-400 uppercase font-bold text-[9px]"
                  >
                    No closing calendar data loaded.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>


      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-3">

        <span className="text-[8px] text-slate-400 font-bold">
          Click any date to load that day's closing stock records.
        </span>

        {(startDateFilter || endDateFilter) && (
          <button
            type="button"
            onClick={() => {
              setStartDateFilter("");
              setEndDateFilter("");
            }}
            className="px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-black text-[8px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            Clear Filter
          </button>
        )}

      </div>

    </div>

  </div>


  {/* ========================================================= */}
  {/* 2. CLOSING STOCK RECORDS - SECOND BLOCK */}
  {/* ========================================================= */}
  <div>

    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="bg-[#174C2C] px-4 py-2.5 flex items-center justify-between">

        <div>
          <div className="text-[11px] font-black text-white uppercase tracking-wider">
            Closing Stock Records
          </div>

          <div className="text-[8px] text-emerald-100 font-semibold mt-0.5">
            Monthly inventory closing details
          </div>
        </div>

        <div className="bg-white/10 border border-white/20 rounded px-2 py-1">
          <span className="text-[8px] font-black text-white uppercase">
            {filteredClosingStocks.length} Records
          </span>
        </div>

      </div>


      {/* Main Table */}
      <div className="overflow-x-auto min-h-[300px]">

        <table className="w-full border-collapse text-[10px]">

          <thead className="bg-slate-50">

            <tr className="border-b border-slate-200 h-9 text-slate-600 uppercase text-left text-[9px]">

              <th className="px-3 border-r border-slate-200 w-24">
                Date
              </th>

              <th className="px-3 border-r border-slate-200 min-w-[150px]">
                Godown / Location
              </th>

              <th className="px-3 border-r border-slate-200">
                Commodity
              </th>

              <th className="px-3 border-r border-slate-200">
                Variety
              </th>

              <th className="px-3 border-r border-slate-200">
                Grade Code
              </th>

              <th className="px-3 border-r border-slate-200 text-right">
                Physical Bales
              </th>

              <th className="px-3 border-r border-slate-200 text-right">
                Weight (MT)
              </th>

              <th className="px-3 border-r border-slate-200 text-right">
                Rate / MT
              </th>

              <th className="px-3 border-r border-slate-200 text-right">
                Total Value (Rs.)
              </th>

              <th className="px-2 text-center w-20">
                Actions
              </th>

            </tr>

          </thead>


          <tbody className="font-bold text-slate-800">

            {filteredClosingStocks.length > 0 ? (

              filteredClosingStocks.slice((closingCurrentPage - 1) * closingPageSize, closingCurrentPage * closingPageSize).map((row, i) => {

                const isSelected =
                  selectedClosingStockId === row.id;

                return (
                  <tr
                    key={row.id || i}
                    onClick={() =>
                      setSelectedClosingStockId(row.id || null)
                    }
                    onDoubleClick={() =>
                      handleEditClosing(row)
                    }
                    className={cn(
                      "h-9 border-b border-slate-100 cursor-pointer transition-all",
                      isSelected
                        ? "bg-[#174C2C] text-white"
                        : i % 2 === 0
                          ? "bg-white hover:bg-emerald-50"
                          : "bg-slate-50/60 hover:bg-emerald-50"
                    )}
                  >

                    <td className="px-3 font-mono">
                      {row.stock_date}
                    </td>

                    <td className="px-3 font-extrabold uppercase truncate max-w-[180px]">
                      {row.godown || "-"}
                    </td>

                    <td className="px-3 uppercase">
                      {row.commodity || "RAW JUTE"}
                    </td>

                    <td className="px-3 uppercase font-extrabold">
                      {row.variety || "TOSSA"}
                    </td>

                    <td className="px-3 uppercase font-black">
                      {row.grade || "-"}
                    </td>

                    <td className="px-3 text-right font-mono">
                      {Number(row.no_of_bales).toLocaleString()}
                    </td>

                    <td className="px-3 text-right font-mono">
                      {(Number(row.weight_qtl) / 10).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td className="px-3 text-right font-mono">
                      ₹ {(Number(row.rate_per_qtl) * 10).toFixed(2)}
                    </td>

                    <td className="px-3 text-right font-mono text-xs font-black">
                      ₹{" "}
                      {Number(row.total_value).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td
                      className="px-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >

                      <div className="flex justify-center items-center gap-1">

                        <button
                          onClick={() =>
                            handleEditClosing(row)
                          }
                          title="Edit Closing Record"
                          className="h-6 w-6 flex items-center justify-center rounded-md text-[#174C2C] hover:bg-emerald-100 cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() =>
                            handleDeleteClosing(
                              row.id,
                              `${row.grade} @ ${row.godown}`
                            )
                          }
                          title="Delete Closing Record"
                          className="h-6 w-6 flex items-center justify-center rounded-md text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                      </div>

                    </td>

                  </tr>
                );

              })

            ) : (

              <tr>
                <td
                  colSpan={10}
                  className="py-20 text-center text-slate-400 uppercase italic tracking-wider"
                >
                  No Monthly Opening Stock records reported.
                  <br />
                  <span className="text-[9px]">
                    Use "New Monthly Record" to register.
                  </span>
                </td>
              </tr>

            )}

          </tbody>

        </table>

      </div>

      <div className="mt-2">
        <PaginationControls
          currentPage={closingCurrentPage}
          totalItems={filteredClosingStocks.length}
          pageSize={closingPageSize}
          onPageChange={setClosingCurrentPage}
          onPageSizeChange={setClosingPageSize}
        />
      </div>

    </div>


    {/* ========================================================= */}
    {/* 3. SUMMARY BLOCK - UNDER CLOSING STOCK TABLE */}
    {/* ========================================================= */}
    <div className="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-3">

      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
        <div className="text-[8px] font-black text-slate-400 uppercase">
          Record Entries
        </div>

        <div className="mt-1 text-sm font-black text-slate-800">
          {filteredClosingStocks.length}
        </div>
      </div>


      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
        <div className="text-[8px] font-black text-slate-400 uppercase">
          Total Bales
        </div>

        <div className="mt-1 text-sm font-black text-[#174C2C]">
          {totalClosingBales.toLocaleString()}
          <span className="text-[8px] ml-1 text-slate-400">
            BALES
          </span>
        </div>
      </div>


      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
        <div className="text-[8px] font-black text-slate-400 uppercase">
          Total Weight
        </div>

        <div className="mt-1 text-sm font-black text-emerald-700">
          {(totalClosingWt / 10).toLocaleString(
            undefined,
            {
              minimumFractionDigits: 2,
            }
          )}

          <span className="text-[8px] ml-1 text-slate-400">
            MT
          </span>
        </div>
      </div>


      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 shadow-sm">

        <div className="text-[8px] font-black text-emerald-700 uppercase">
          Store Asset Value
        </div>

        <div className="mt-1 text-sm font-black text-[#174C2C]">
          ₹{" "}
          {totalClosingValue.toLocaleString(
            undefined,
            {
              minimumFractionDigits: 2,
            }
          )}
        </div>

      </div>

    </div>

  </div>

</div>
            )}

          </div>
        ) : (
          /* Tab 2: Standard Live Valuation summary (Original Stock Summary Grid) */
          <>
            {/* Multi-Filter Dropdowns and Search */}
            <div className="bg-[#d4d0c8] p-2 border border-gray-400 flex flex-wrap gap-2 items-center text-xs font-bold">
               <div className="flex items-center gap-1 bg-white border border-gray-400 px-2 py-1 flex-1 min-w-[200px]">
                  <Search className="h-3.5 w-3.5 text-gray-500" />
                  <input 
                     className="flex-1 bg-transparent outline-none font-bold text-xs" 
                     placeholder="Search stock by grade or godown..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="text-red-700 text-[9px] uppercase font-black">Clear</button>}
               </div>

               {/* Grade Filter */}
               <div className="flex items-center gap-1 bg-white border border-gray-400 px-2 py-1">
                  <span className="text-[9px] text-gray-600 uppercase font-black">Grade:</span>
                  <select 
                     value={selectedGradeFilter} 
                     onChange={(e) => setSelectedGradeFilter(e.target.value)}
                     className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                  >
                     <option value="ALL">All Grades</option>
                     {mergedGrades.map((g: any, gi: number) => {
                       const gName = g.grade_name || g.name || g.code || '';
                       return <option key={gi} value={gName}>{gName}</option>;
                     })}
                  </select>
               </div>

               {/* Area Filter */}
               <div className="flex items-center gap-1 bg-white border border-gray-400 px-2 py-1">
                  <span className="text-[9px] text-gray-600 uppercase font-black">Area:</span>
                  <select 
                     value={selectedAreaFilter} 
                     onChange={(e) => setSelectedAreaFilter(e.target.value)}
                     className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                  >
                     <option value="ALL">All Areas</option>
                     {areas.map((a: any, ai: number) => {
                       const aName = a.area_name || a.name || '';
                       return <option key={ai} value={aName}>{aName}</option>;
                     })}
                  </select>
               </div>

               {/* Godown Filter */}
               <div className="flex items-center gap-1 bg-white border border-gray-400 px-2 py-1">
                  <span className="text-[9px] text-gray-600 uppercase font-black">Godown:</span>
                  <select 
                     value={selectedGodownFilter} 
                     onChange={(e) => setSelectedGodownFilter(e.target.value)}
                     className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                  >
                     <option value="ALL">All Godowns</option>
                     {godowns.map((g: any, gi: number) => {
                       const gName = g.gdn_name || g.name || g.gdn_code || '';
                       return <option key={gi} value={gName}>{gName}</option>;
                     })}
                  </select>
               </div>

               <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={handleExportLiveStockToCSV}
                    className="h-7 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-black uppercase flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPdfModalOpen(true)}
                    className="h-7 px-3 bg-red-700 hover:bg-red-800 text-white rounded text-[10px] font-black uppercase flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Export to PDF
                  </button>
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
                        <th className="px-4 text-center border-r border-[#808080]/30 bg-blue-50/20 flex items-center justify-center gap-1">
                           <span>Current Stock Balance (Bales)</span>
                           <StockSparkline />
                        </th>
                        <th className="px-6 text-right">Net Wt. Balance (MT)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-bold text-slate-750">
                     {(() => {
                       const liveStocks = calculateLiveStocks();
                       const filteredLive = liveStocks.filter(item => {
                         if (selectedGradeFilter !== 'ALL' && item.grade.toUpperCase() !== selectedGradeFilter.toUpperCase()) {
                           return false;
                         }
                         const gradeRecs = openingStocks.filter(r => String(r.grade || '').trim().toUpperCase() === item.grade.toUpperCase());
                         if (selectedAreaFilter !== 'ALL') {
                           const hasArea = gradeRecs.some(r => String(r.area || '').trim().toUpperCase() === selectedAreaFilter.toUpperCase());
                           if (!hasArea) return false;
                         }
                         if (selectedGodownFilter !== 'ALL') {
                           const hasGodown = gradeRecs.some(r => String(r.godown || '').trim().toUpperCase() === selectedGodownFilter.toUpperCase());
                           if (!hasGodown) return false;
                         }
                         if (!searchQuery) return true;
                         const q = searchQuery.toLowerCase().trim();
                         return item.grade.toLowerCase().includes(q) || gradeRecs.some(r => String(r.godown || '').toLowerCase().includes(q) || String(r.area || '').toLowerCase().includes(q));
                       });

                       if (filteredLive.length === 0) {
                         return (
                           <tr>
                             <td colSpan={6} className="px-6 py-4 text-center text-gray-500 italic">
                               No matching dynamic stock balances found with current filters.
                             </td>
                           </tr>
                         );
                       }

                       return filteredLive.slice((liveCurrentPage - 1) * livePageSize, liveCurrentPage * livePageSize).map((item, idx) => (
                         <StockItemRow
                           key={idx}
                           name={item.grade}
                           opening={item.openingQty.toLocaleString()}
                           incoming={item.incomingQty.toLocaleString()}
                           outgoing={item.outgoingQty.toLocaleString()}
                           balance={item.balanceQty.toLocaleString()}
                           weight={(item.balanceWt / 10).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                           isExpanded={expandedLiveGrades[item.grade]}
                           onToggle={() => setExpandedLiveGrades(p => ({ ...p, [item.grade]: !p[item.grade] }))}
                           openingStocks={openingStocks}
                           onTransfer={(rec: any) => setTransferRecord(rec)}
                           onUpdateGodown={(rec: any) => { setUpdateGodownRecord(rec); setNewGodownName(rec.godown || ''); }}
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

             <div className="mt-2 mb-2">
               {(() => {
                 const liveStocks = calculateLiveStocks();
                 const filteredLive = liveStocks.filter(item => {
                   if (selectedGradeFilter !== 'ALL' && item.grade.toUpperCase() !== selectedGradeFilter.toUpperCase()) {
                     return false;
                   }
                   const gradeRecs = openingStocks.filter(r => String(r.grade || '').trim().toUpperCase() === item.grade.toUpperCase());
                   if (selectedAreaFilter !== 'ALL') {
                     const hasArea = gradeRecs.some(r => String(r.area || '').trim().toUpperCase() === selectedAreaFilter.toUpperCase());
                     if (!hasArea) return false;
                   }
                   if (selectedGodownFilter !== 'ALL') {
                     const hasGodown = gradeRecs.some(r => String(r.godown || '').trim().toUpperCase() === selectedGodownFilter.toUpperCase());
                     if (!hasGodown) return false;
                   }
                   if (!searchQuery) return true;
                   const q = searchQuery.toLowerCase().trim();
                   return item.grade.toLowerCase().includes(q) || gradeRecs.some(r => String(r.godown || '').toLowerCase().includes(q) || String(r.area || '').toLowerCase().includes(q));
                 });
                 return (
                   <PaginationControls
                     currentPage={liveCurrentPage}
                     totalItems={filteredLive.length}
                     pageSize={livePageSize}
                     onPageChange={setLiveCurrentPage}
                     onPageSizeChange={setLivePageSize}
                   />
                 );
               })()}
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

      {/* Modals & Popups */}
      <StockFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        stockSubTab={stockSubTab}
        isEditing={isEditing}
        loading={loading}
        formState={formState}
        setFormState={setFormState}
        handleSubmit={handleSubmit}
        closingFormState={closingFormState}
        setClosingFormState={setClosingFormState}
        handleClosingSubmit={handleClosingSubmit}
        handleClosingFieldChange={handleClosingFieldChange}
        showCustomGradeClosing={showCustomGradeClosing}
        setShowCustomGradeClosing={setShowCustomGradeClosing}
        customGradeValueClosing={customGradeValueClosing}
        setCustomGradeValueClosing={setCustomGradeValueClosing}
        mergedGodowns={mergedGodowns}
        mergedAreas={mergedAreas}
        mergedGrades={mergedGrades}
        mergedUnits={mergedUnits}
      />

      <StockOpeningPrintModal
        isOpen={isPrintingModalOpen}
        onClose={() => setIsPrintingModalOpen(false)}
        printData={printData}
      />

      <StockClosingPrintModal
        isOpen={isClosingPrintModalOpen}
        onClose={() => setIsClosingPrintModalOpen(false)}
        printClosingData={printClosingData}
      />

      <StockCapacityAuditModal
        isOpen={showCapacityPopup}
        onClose={() => setShowCapacityPopup(false)}
        filteredSavedStocks={filteredSavedStocks}
        getGodownCapacityAndName={getGodownCapacityAndName}
        popupSearchQuery={popupSearchQuery}
        setPopupSearchQuery={setPopupSearchQuery}
      />

      <StockTransferModal
        transferRecord={transferRecord}
        onClose={() => setTransferRecord(null)}
        godowns={mergedGodowns}
        transferTargetGodown={transferTargetGodown}
        setTransferTargetGodown={setTransferTargetGodown}
        transferBales={transferBales}
        setTransferBales={setTransferBales}
        onExecuteTransfer={handleExecuteTransfer}
      />

      <StockUpdateGodownModal
        updateGodownRecord={updateGodownRecord}
        onClose={() => setUpdateGodownRecord(null)}
        newGodownName={newGodownName}
        setNewGodownName={setNewGodownName}
        onExecuteUpdateGodown={handleExecuteUpdateGodown}
      />

      <StockPdfSummaryModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        liveStocks={calculateLiveStocks()}
        openingStocks={filteredSavedStocks}
      />

    </LegacyLayout>
  );
}
