import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  X,
  Printer,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { Sauda, SaudaQualityDetail } from '../types';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission } from '../lib/permissions';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

const MARKS_OPTIONS = [
  "NO MARK", "SH", "CHANGE", "MJ", "BSP", "RT", "PUROHIT", "DB", "KK", 
  "C.M", "BS", "IM", "NI", "RIEEM", "MAA", "V VISHNU", "KR", "SUNIL", 
  "SARTAJ", "J.S.J", "PK", "ANAND", "RR", "HARI", "PS", "RS", "MR", 
  "GOPAL", "A.P.J.S", "SUN", "SAHEB", "C.R.D", "SM", "SA", "AM", "RABI", 
  "AD", "ML", "RK", "MUBIN", "AMAN", "SKB", "ANTIMA", "SHM", "JMP", 
  "HM", "SN", "KT", "LN", "RAJU", "RA", "SS", "SR", "RAHA", "TT", 
  "USHA", "OP", "ST", "PB", "SK", "BAHETI", "DR", "ROHIT", "BK", "KAMAL", 
  "JM", "CHAIN", "SSB", "SANVI", "BR", "UDM", "JAYA", "MM", "SANGITA", 
  "S", "HBGM", "DHRUV", "SD", "AS", "BALAJI", "AJAY", "SG", "GS", "SB", 
  "RE", "JS", "RM", "RBT", "BD", "MS", "RAEEM", "TS", "TOSH", "LC", 
  "SUMAN", "VANSH", "DK", "BHAWANI", "BP", "SHIV", "SHREE HARI", "A", 
  "KS", "KJ", "VK", "JK", "ARHAM", "SOVA", "KM", "PRAMOD", "PUJA", "DURGA", 
  "JSB", "NS", "JAY HANUMAN", "MB", "MANOJ", "SHUBHAM", "KISHAN", "JAY", 
  "AX", "SKC", "YUNUS", "BIJOY", "BN", "A.J.P", "J/MU/DK", "J/MU/HP", "AP", 
  "ANISH", "RISHAV", "SKS", "BUL BUL", "KEDIA", "SMB", "NAIZA", "MH", "BULBUL", 
  "RAKHECHA", "R.JAIN", "MKC", "NC", "MRR", "P", "J.A.K.", "JAK", "GOBINDA", 
  "RAM", "TULSI G", "PP", "HARI OM", "MOTI", "GK", "KRISHNA", "SANJOY", "AA", 
  "MP", "TANU", "ASHA", "DNJ(BHOWMICK)", "SUMIT", "TULSI/H", "KP", "K.L.K", 
  "SWASTIK", "JC", "PM", "BB", "GM", "SHREE"
];

const UNIT_OPTIONS = ["DRUMS", "BALES", "LOOSE", "P.BALES", "H.BALES"];

const EXCEL_SEED_DATA = [
  {
    area: "DAISEE",
    diffs: { TD4: 600, TD5: -300, TD6: -200, TD7: -500, TD8: -1000, "H.BALES": -50, DRUMS: -100 }
  },
  {
    area: "TULSIHATTA",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "BANGLADESH",
    diffs: { "BTR HD KS": 2800, "BTR HD CS": 2300, "BTR HD BS": 1800, "BTR NB KS": 800, "BTR NB FFS": 1300, "BTR NB (SMR)": 200 }
  },
  {
    area: "GRP LOOSE",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "L/A TARABARI",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "U/ASSAM",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100, LOOSE: -200 }
  },
  {
    area: "KANKI",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "RAIGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "COOCHBEHAR",
    diffs: { TD4: 1400, TD5: 1000, TD6: 500, TD7: -100, TD8: -500 }
  },
  {
    area: "JALPAIGURI",
    diffs: { TD4: 1400, TD5: 1000, TD6: 500, TD7: -100, TD8: -500 }
  },
  {
    area: "SOUTH BENGAL",
    diffs: { TD4: 600, TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "NORTHERN",
    diffs: { TD4: 1400, TD5: 1000, TD6: 500, TD7: -100, TD8: -500 }
  },
  {
    area: "SEMI NORTHERN",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "MATHABHANGA",
    diffs: { TD4: 1500, TD5: 1100, TD6: 600, TD7: 0, TD8: -400 }
  },
  {
    area: "PURNEA(BIHAR)",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "HALDIBARI",
    diffs: { TD4: 1600, TD5: 1200, TD6: 700, TD7: 100, TD8: -300 }
  },
  {
    area: "L/ASSAM",
    diffs: { TD4: 1500, TD5: 1100, TD6: 600, TD7: 0, TD8: -400 }
  },
  {
    area: "M/ASSAM",
    diffs: { TD4: 1700, TD5: 1300, TD6: 800, TD7: 200, TD8: -200 }
  },
  {
    area: "DHUPGURI",
    diffs: { TD4: 1500, TD5: 1100, TD6: 600, TD7: 0, TD8: -400 }
  },
  {
    area: "BELAKOBA",
    diffs: { TD4: 1600, TD5: 1200, TD6: 700, TD7: 100, TD8: -300 }
  },
  {
    area: "ISLAMPUR",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "KISANGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "MURLIGANJ",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "GULABBHAG",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "C.H/S.C",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "ASSAM",
    diffs: { TD4: 1600, TD5: 1200, TD6: 700, TD7: 100, TD8: -300 }
  },
  {
    area: "BTR HD KS",
    diffs: { "BTR HD KS": 2800 }
  },
  {
    area: "BTR HD CS",
    diffs: { "BTR HD CS": 2300 }
  },
  {
    area: "BTR HD BS",
    diffs: { "BTR HD BS": 1800 }
  },
  {
    area: "BTR NB KS",
    diffs: { "BTR NB KS": 800 }
  },
  {
    area: "BTR NB FFS",
    diffs: { "BTR NB FFS": 1300 }
  },
  {
    area: "BTR NB(SMR)",
    diffs: { "BTR NB (SMR)": 200 }
  }
];


const compareQualities = (aStr: string, bStr: string): number => {
  const clean = (val: string) => {
    return String(val || '')
      .trim()
      .replace(/\.$/, '') // strip trailing dot
      .replace(/\s+/g, '') // strip all spaces
      .toUpperCase();
  };

  const a = clean(aStr);
  const b = clean(bStr);

  if (!a && !b) return 0;
  if (!a) return 1; // empty to the end
  if (!b) return -1;

  const PREDEFINED_RANKS: Record<string, number> = {
    'TD1': 10, 'TD2': 20, 'TD3': 30, 'TD4': 40, 'TD5': 50, 'TD6': 60, 'TD7': 70, 'TD8': 80,
    'W1': 110, 'W2': 120, 'W3': 130, 'W4': 140, 'W5': 150, 'W6': 160, 'W7': 170, 'W8': 180,
    'M1': 210, 'M2': 220, 'M3': 230, 'M4': 240, 'M5': 250, 'M6': 260, 'M7': 270, 'M8': 280,
    'BTC': 310, 'BTR': 320,
    'STANDARD GRADE': 1000, 'NORMAL GRADE': 1010
  };

  const rankA = PREDEFINED_RANKS[a];
  const rankB = PREDEFINED_RANKS[b];

  if (rankA !== undefined && rankB !== undefined) {
    return rankA - rankB;
  }
  if (rankA !== undefined) return -1;
  if (rankB !== undefined) return 1;

  const regex = /^([A-Z]+)(\d+)(.*)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const numA = parseInt(matchA[2], 10);
    const prefixB = matchB[1];
    const numB = parseInt(matchB[2], 10);

    if (prefixA === prefixB) {
      return numA - numB;
    }
    return prefixA.localeCompare(prefixB);
  }

  return a.localeCompare(b);
};

export default function SaudaEntry({ initialData, onSave, onCancel }: { initialData?: any; onSave?: (d: any) => void; onCancel?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [baseRatesList, setBaseRatesList] = useState<any[]>([]);
  const [dbDiffsList, setDbDiffsList] = useState<any[]>([]);
  
  const today = new Date().toISOString().split('T')[0];
  
  const getInitialFormData = (): Sauda => {
    if (initialData) {
      const copy = { ...initialData };
      copy.broker = (copy.broker || '').toUpperCase();
      copy.supplier = (copy.supplier || '').toUpperCase();
      copy.challan_supplier = (copy.challan_supplier || '').toUpperCase();
      copy.area = (copy.area || '').toUpperCase();
      if (!copy.quality_details) {
        copy.quality_details = [];
      }
      
      const realQD = (copy.quality_details || [])
        .filter((item: any) => item.quality || item.qty || item.agency || item.marka || item.rs)
        .sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));

      const existingCount = realQD.length;
      if (existingCount < 7) {
        const remaining = 7 - existingCount;
        const extra = Array.from({ length: remaining }, () => ({ quality: '', qty: 0, agency: '', marka: '', rs: 0 }));
        copy.quality_details = [...realQD, ...extra];
      } else {
        copy.quality_details = realQD;
      }
      return copy;
    }
    return {
      sauda_no: '0152',
      financial_year: '2026-2027',
      session: 'BJCL/2026-2027/',
      po_type: 'Normal',
      date: today,
      broker: '',
      supplier: '',
      challan_supplier: '',
      area: '',
      agency: '',
      marks: '',
      no_of_lorries: 1,
      units_per_lorry_type: 'BALES',
      total_unit: 0,
      wt_per_lorry: 0,
      unit_type: 'BALES',
      total_wt_in_ton: 0,
      shipment_date: today,
      shipment_days: 0,
      shipment_penalty: 5,
      marks_claim: 0,
      quantity_claim: 0,
      remarks: 'Area, Agency Grade, Grade differential can change as per market.',
      b_rate: 0,
      b_date: today,
      superior_normal_marks: '',
      status: 'pending',
      quality_details: Array.from({ length: 7 }, () => ({ quality: '', qty: 0, agency: '', marka: '', rs: 0 }))
    };
  };

  const [formData, setFormData] = useState<Sauda>(getInitialFormData());
  const [unitOptions, setUnitOptions] = useState<string[]>(UNIT_OPTIONS);

  useEffect(() => {
    async function fetchUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitOptions(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn("Failed to load unit_master in SaudaEntry", err);
      }
    }
    fetchUnits();
  }, []);

  const formContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(formContainerRef, () => {
     handleSave();
  });

  useEffect(() => {
    // Load dropdown data
    async function loadData() {
      try {
        // Pro-active Schema Check: Ensure sauda_quality_details has agency and marka columns in the live Supabase DB
        if (supabase) {
          try {
            await supabase.rpc("exec_sql", {
              query: `
                ALTER TABLE sauda_quality_details ADD COLUMN IF NOT EXISTS agency TEXT;
                ALTER TABLE sauda_quality_details ADD COLUMN IF NOT EXISTS marka TEXT;
              `
            });
            console.log("Schema auto-aligned: agency and marka columns verified on sauda_quality_details.");
          } catch (err) {
            console.warn("Schema auto-align finished (columns might already exist or admin permission missing):", err);
          }
        }

        const [brokData, suppData, areaData, agcData, gradeData, markaData, allSaudas, sattaBaseRates, sattaDiffs] = await Promise.all([
          dbModule.fetchAll('broker_master'),
          dbModule.fetchAll('supply_master'),
          dbModule.fetchAll('area_master'),
          dbModule.fetchAll('agency_master'),
          dbModule.fetchAll('grade_master'),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('sauda_master'),
          supabase ? supabase.from('satta_base_rates').select('*').order('start_date', { ascending: false }).then(r => r.data || []) : Promise.resolve([]),
          supabase ? supabase.from('satta_differentials').select('*').then(r => r.data || []) : Promise.resolve([])
        ]);
        setBrokers((brokData || []).map((b: any) => ({ ...b, brok_name: (b.brok_name || '').toUpperCase() })));
        setSuppliers((suppData || []).map((s: any) => ({ ...s, supp_name: (s.supp_name || '').toUpperCase() })));
        setAreas((areaData || []).map((a: any) => ({ ...a, area_name: (a.area_name || '').toUpperCase() })));
        setAgencies(agcData || []);
        setGrades(gradeData || []);
        setMarkas(markaData || []);
        setBaseRatesList(sattaBaseRates || []);
        setDbDiffsList(sattaDiffs || []);

        // Dynamic auto-increment for a new Sauda entry
        if (!initialData && allSaudas && allSaudas.length > 0) {
          let lastNum = 152; // Default baseline
          allSaudas.forEach((s: any) => {
            const sn = s.sauda_no || '';
            const num = parseInt(sn.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > lastNum) {
              lastNum = num;
            }
          });
          const nextNum = lastNum + 1;
          const formattedNum = String(nextNum).padStart(4, '0');
          setFormData(prev => ({
            ...prev,
            sauda_no: formattedNum,
            session: `BJCL/2026-2027/`
          }));
        }
      } catch(e) {
        console.error("Error loading masters:", e);
      }
    }
    loadData();
  }, []);


  const recalculateRowRate = (date: string, area: string, grade: string) => {
    if (!date || !area || !grade || baseRatesList.length === 0) return null;
    
    // Find first base rate effective on or before Sauda contract's date
    const dStr = date;
    const sortedBaseRates = [...baseRatesList].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const effectiveBase = sortedBaseRates.find(r => r.start_date <= dStr) || sortedBaseRates[sortedBaseRates.length - 1];
    const baseVal = effectiveBase ? Number(effectiveBase.base_rate) : 17500;

    const cleanArea = area.trim().toUpperCase();
    const cleanGrade = grade.trim().toUpperCase();

    const lookupAreas = [cleanArea];
    if (cleanArea === 'SEMI NORTHERN' || cleanArea.includes('SEMI NORTHERN')) {
      lookupAreas.push('NORTHERN');
    } else if (cleanArea === 'NORTHERN' || cleanArea.includes('NORTHERN')) {
      lookupAreas.push('SEMI NORTHERN');
    }

    // PURNEA and BIHAR are synonyms under Satta charts matching PURNEA(BIHAR)
    if (cleanArea.includes('PURNEA') || cleanArea.includes('BIHAR')) {
      if (!lookupAreas.includes('PURNEA(BIHAR)')) lookupAreas.push('PURNEA(BIHAR)');
      if (!lookupAreas.includes('PURNEA (BIHAR)')) lookupAreas.push('PURNEA (BIHAR)');
      if (!lookupAreas.includes('PURNEA')) lookupAreas.push('PURNEA');
      if (!lookupAreas.includes('BIHAR')) lookupAreas.push('BIHAR');
    }

    // Find differential from db table satta_differentials
    let diffVal: number | undefined;
    for (const lookupArea of lookupAreas) {
      const diffObj = dbDiffsList.find(
        d => (d.area || '').toUpperCase() === lookupArea && 
             (d.grade || '').toUpperCase() === cleanGrade
      );
      if (diffObj) {
        diffVal = Number(diffObj.differential);
        break;
      }
    }
    
    if (diffVal === undefined) {
      for (const lookupArea of lookupAreas) {
        // Fallback matching case-insensitively to EXCEL_SEED_DATA
        const seedArea = EXCEL_SEED_DATA.find(r => r.area.toUpperCase() === lookupArea);
        if (seedArea && seedArea.diffs) {
          const key = Object.keys(seedArea.diffs).find(k => k.toUpperCase() === cleanGrade);
          if (key) {
            diffVal = seedArea.diffs[key] as number;
            break;
          }
        }
      }
    }

    if (diffVal !== undefined) {
      return baseVal + diffVal;
    }

    return null;
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'broker' || name === 'supplier' || name === 'challan_supplier' || name === 'area') {
      finalValue = (value || '').toUpperCase();
    }
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: finalValue
      };
      
      if (name === 'units_per_lorry_type') {
        updated.unit_type = finalValue;
      }

      // Automatically calculate total_wt_in_ton = no_of_lorries * wt_per_lorry

      // Automatically update quality rates if area changes
      if (name === 'area' && finalValue) {
        let firstCalculated = null;
        const updatedQD = (updated.quality_details || []).map((row: any, i: number) => {
          if (row.quality) {
            const calculatedPrice = recalculateRowRate(updated.date || today, finalValue, row.quality);
            if (calculatedPrice !== null) {
              if (i === 0) firstCalculated = calculatedPrice;
              return { ...row, rs: calculatedPrice };
            }
          }
          return row;
        });
        updated.quality_details = updatedQD;
        if (firstCalculated !== null) updated.b_rate = firstCalculated;
      }

      // Automatically update quality rates if date changes
      if (name === 'date' && finalValue && prev.area) {
        let firstCalculated = null;
        const updatedQD = (updated.quality_details || []).map((row: any, i: number) => {
          if (row.quality) {
            const calculatedPrice = recalculateRowRate(finalValue, prev.area, row.quality);
            if (calculatedPrice !== null) {
              if (i === 0) firstCalculated = calculatedPrice;
              return { ...row, rs: calculatedPrice };
            }
          }
          return row;
        });
        updated.quality_details = updatedQD;
        if (firstCalculated !== null) updated.b_rate = firstCalculated;
      }

      if (name === 'no_of_lorries' || name === 'wt_per_lorry') {
        const lorries = name === 'no_of_lorries' ? parseFloat(value) || 0 : parseFloat(prev.no_of_lorries as any) || 0;
        const wt = name === 'wt_per_lorry' ? parseFloat(value) || 0 : parseFloat(prev.wt_per_lorry as any) || 0;
        updated.total_wt_in_ton = parseFloat((lorries * wt).toFixed(3));
      }
      
      // Auto-extract sauda_no and financial_year from session input to keep them in sync
      if (name === 'session' && value) {
        const parts = value.split('/');
        if (parts.length >= 3) {
          const extractedSaudaNo = parts[parts.length - 1].trim();
          const extractedFinYear = parts[parts.length - 2].trim();
          if (extractedSaudaNo) updated.sauda_no = extractedSaudaNo;
          if (extractedFinYear) updated.financial_year = extractedFinYear;
        } else if (parts.length === 2) {
          const extractedSaudaNo = parts[1].trim();
          const extractedFinYear = parts[0].trim();
          if (extractedSaudaNo) updated.sauda_no = extractedSaudaNo;
          if (extractedFinYear) updated.financial_year = extractedFinYear;
        } else {
          // If session is a simple string (e.g. 2026-2027), do NOT overwrite sauda_no
        }
      }

      // Automatically sync session when P.O. Number (sauda_no) is modified
      if (name === 'sauda_no' && value) {
        const cleanVal = value.trim();
        const financialYear = prev.financial_year || '2026-2027';
        if (prev.session && prev.session.includes('/')) {
          const parts = prev.session.split('/');
          parts[parts.length - 1] = cleanVal;
          updated.session = parts.join('/');
        } else {
          updated.session = `BJCL/${financialYear}/${cleanVal}`;
        }
      }
      return updated;
    });
  };

  const handleQualityChange = (index: number, e: any) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const qd = [...(prev.quality_details || [])];
      qd[index] = { ...qd[index], [name]: value };

      // Auto-populate computed rate if quality/grade is selected
      if (name === 'quality' && value && prev.area) {
        const calculatedPrice = recalculateRowRate(prev.date || today, prev.area, value);
        if (calculatedPrice !== null) {
          qd[index].rs = calculatedPrice;
          if (index === 0) {
             // also update global b_rate if this is the first row
             return { ...prev, quality_details: qd, b_rate: calculatedPrice };
          }
        }
      }

      return { ...prev, quality_details: qd };
    });
  };

  const handleAddQualityRow = () => {
    setFormData(prev => ({
      ...prev,
      quality_details: [...(prev.quality_details || []), { quality: '', qty: 0, agency: '', marka: '', rs: 0 }]
    }));
  };

  const handleDeleteQualityRow = () => {
    setFormData(prev => {
      const current = prev.quality_details || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        quality_details: current.slice(0, -1)
      };
    });
  };

  const handleSave = async () => {
    if ((formData.sauda_id || initialData) && !enforceEditOrDeletePermission("Edit")) {
      return;
    }
    setLoading(true);
    try {
      const saudaData = { ...formData };
      
      // Secondary absolute sync for sauda_no and financial_year from session right before database save
      if (saudaData.session) {
        const parts = saudaData.session.split('/');
        if (parts.length >= 3) {
          const extractedSaudaNo = parts[parts.length - 1].trim();
          const extractedFinYear = parts[parts.length - 2].trim();
          if (extractedSaudaNo) saudaData.sauda_no = extractedSaudaNo;
          if (extractedFinYear) saudaData.financial_year = extractedFinYear;
        } else if (parts.length === 2) {
          const extractedSaudaNo = parts[1].trim();
          const extractedFinYear = parts[0].trim();
          if (extractedSaudaNo) saudaData.sauda_no = extractedSaudaNo;
          if (extractedFinYear) saudaData.financial_year = extractedFinYear;
        } else {
          // Keep sauda_no as is if session is just a simple string (e.g. 2026-2027)
        }
      }

      // Sanitize numeric/integer fields to prevent PostgreSQL syntax errors with empty strings ""
      const numericFields = [
        'no_of_lorries',
        'total_unit',
        'wt_per_lorry',
        'total_wt_in_ton',
        'shipment_days',
        'shipment_penalty',
        'marks_claim',
        'quantity_claim',
        'b_rate'
      ];
      
      numericFields.forEach(field => {
        const val = (saudaData as any)[field];
        if (val === '' || val === undefined || val === null) {
          (saudaData as any)[field] = null;
        } else {
          (saudaData as any)[field] = Number(val);
        }
      });

      const dateFields = ['date', 'shipment_date', 'b_date'];
      dateFields.forEach(field => {
        const val = (saudaData as any)[field];
        if (val === '' || val === undefined) {
          (saudaData as any)[field] = null;
        }
      });

      if (!saudaData.date) {
        saudaData.date = today;
      }

      const qd = saudaData.quality_details;
      delete saudaData.quality_details;
      
      let inserted;
      let isEditMode = !!saudaData.sauda_id;

      if (!saudaData.sauda_id && saudaData.sauda_no) {
         // Double-check if a Sauda with the same number and financial year already exists to prevent duplicate rows
         const targetFYear = saudaData.financial_year || '2026-2027';
         const allSaudas = await dbModule.fetchAll('sauda_master').catch(() => []);
         const match = allSaudas.find((s: any) => s.sauda_no === saudaData.sauda_no && s.financial_year === targetFYear);
         if (match) {
            saudaData.sauda_id = match.sauda_id;
            isEditMode = true;
         }
      }

      if (saudaData.sauda_id) {
         inserted = await dbModule.update('sauda_master', 'sauda_id', saudaData.sauda_id, saudaData);
      } else {
         inserted = await dbModule.insert('sauda_master', saudaData);
      }
      
      if (inserted && qd) {
        // Simple way for edit: delete old quality details if editing, then re-insert
        if (isEditMode) {
           await dbModule.delete('sauda_quality_details', 'sauda_id', inserted.sauda_id);
        }

        const sortedQd = [...qd].sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
        for (const row of sortedQd) {
          if (row.quality || row.qty || row.rs || row.marka || row.agency) {
             try {
                await dbModule.insert('sauda_quality_details', {
                  sauda_id: inserted.sauda_id,
                  financial_year: inserted.financial_year || saudaData.financial_year,
                  quality: row.quality,
                  qty: Number(row.qty) || 0,
                  agency: row.agency || '',
                  marka: row.marka || '',
                  rs: Number(row.rs) || 0
                });
             } catch(e) { console.log(e); }
          }
        }
      }
      
      alert("Sauda Contract saved successfully!");
      onSave?.(saudaData);
    } catch (err: any) {
      console.error(err);
      alert("Save failed: " + (err.message || "Database error."));
    } finally {
      setLoading(false);
    }
  };

  const displaySessionValue = (formData.session && formData.session.includes('/')) 
    ? formData.session.split('/').slice(0, 2).join('/') + '/' 
    : formData.session;

  return (
    <LegacyLayout 
      title={initialData ? "P.O Automation » [EDIT SAUDA / ORDER]" : "P.O Automation » [NEW SAUDA / ORDER ENTRY]"} 
      subtitle={initialData ? "Update existing Sauda Contract / Order" : "Create a new Sauda Contract / Order"} 
      onClose={onCancel}
    >
      <div ref={formContainerRef} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* Main Header Form */}
        <div className="grid grid-cols-12 gap-4">
           {/* Feeding Column */}
           <div className="col-span-12 flex flex-col gap-4">
              <LegacyFieldset legend="Basic Details">
                 <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-1 items-center">
                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-12 shrink-0">Session</label>
                        <input className="flex-1 bg-slate-100 border border-gray-400 p-0.5 text-xs font-black text-slate-600" name="session" value={displaySessionValue} readOnly title="Session base path" />
                     </div>

                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-20 shrink-0 text-red-900 uppercase">Order No.</label>
                        <input className="flex-1 bg-[#ffffd0] border border-gray-400 p-0.5 text-xs font-black text-red-900" name="sauda_no" value={formData.sauda_no || ''} onChange={handleChange} placeholder="e.g. 0152" required />
                     </div>
                     
                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-16 shrink-0 text-blue-900 italic uppercase">P.O. Type</label>
                        <select name="po_type" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.po_type} onChange={handleChange}>
                           <option>Normal</option>
                           <option>PTF</option>
                        </select>
                     </div>
                     
                     <div className="col-span-3 flex items-center gap-2">
                        <label className="text-[11px] font-bold w-12 shrink-0">Date</label>
                        <input type="date" name="date" value={formData.date} onChange={handleChange} className="flex-1 bg-white border border-gray-400 p-0.5 text-xs outline-none" />
                     </div>

                    <ComboField label="Broker" name="broker" value={formData.broker} onChange={handleChange} options={brokers.map(b => b.brok_name)} />
                    <ComboField label="Supplier" name="supplier" value={formData.supplier} onChange={handleChange} options={suppliers.map(s => s.supp_name)} />
                    <ComboField label="Challan Supplier" name="challan_supplier" value={formData.challan_supplier} onChange={handleChange} options={suppliers.map(s => s.supp_name)} />
                    <ComboField label="Area" name="area" value={formData.area} onChange={handleChange} options={areas.map(a => a.area_name)} />

                 </div>
              </LegacyFieldset>

              <div className="grid grid-cols-12 gap-x-4">
                 <div className="col-span-8">
                    <LegacyFieldset legend="Unit & Transportation Details">
                       <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-1 items-center px-1 pb-1">
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">No. of Lorries</label>
                             <input type="number" name="no_of_lorries" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.no_of_lorries} onChange={handleChange} />
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Units/Lorry</label>
                             <select name="units_per_lorry_type" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.units_per_lorry_type} onChange={handleChange}>
                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                             </select>
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Total Unit</label>
                             <input type="number" name="total_unit" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.total_unit} onChange={handleChange} />
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Wt/Lorry</label>
                             <input type="number" name="wt_per_lorry" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.wt_per_lorry} onChange={handleChange} />
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Unit Type</label>
                             <select name="unit_type" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.unit_type} onChange={handleChange}>
                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                             </select>
                          </div>
                          <div className="flex items-center gap-2">
                             <label className="text-[11px] font-bold w-24 shrink-0 text-gray-700">Total Wt. in Ton</label>
                             <input type="number" name="total_wt_in_ton" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.total_wt_in_ton} onChange={handleChange} />
                          </div>
                       </div>
                    </LegacyFieldset>
                 </div>
                 
                 <div className="col-span-4">
                    <LegacyFieldset legend="Issue">
                       <div className="flex flex-col gap-y-3 mt-1 items-center justify-center p-4">
                          <span className="text-gray-400 text-xs italic">No issues recorded</span>
                       </div>
                    </LegacyFieldset>
                 </div>
              </div>
              
              <LegacyFieldset legend="Quality Details">
                 <div className="flex justify-end gap-1.5 mb-1.5">
                    <button
                       type="button"
                       onClick={handleAddQualityRow}
                       className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                       + Spawn Row
                    </button>
                    <button
                       type="button"
                       onClick={handleDeleteQualityRow}
                       className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                       - Delete Row
                    </button>
                 </div>
                 <div className="grid grid-cols-12 gap-2 border-b border-gray-400 bg-gray-200 p-1">
                    <div className="col-span-3 text-[10px] font-bold uppercase text-center">Quality</div>
                    <div className="col-span-2 text-[10px] font-bold uppercase text-center">Qty</div>
                    <div className="col-span-3 text-[10px] font-bold uppercase text-center">Agency</div>
                    <div className="col-span-2 text-[10px] font-bold uppercase text-center">Marka</div>
                    <div className="col-span-2 text-[10px] font-bold uppercase text-center">Rs.</div>
                 </div>
                 {formData.quality_details?.map((qd, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 mt-1 items-center">
                       <div className="col-span-3">
                          <select 
                             name="quality" 
                             className="w-full bg-white border border-gray-400 p-0.5 text-xs font-bold" 
                             value={grades.find(g => {
                               const clean = (s) => (s || '').trim().replace(/\.$/, '').toUpperCase();
                               return clean(g.grade_name) === clean(qd.quality) || clean(g.grade_code) === clean(qd.quality);
                             })?.grade_name || qd.quality || ''} 
                             onChange={(e) => handleQualityChange(i, e)}
                           >
                             <option value="">--Select Quality--</option>
                             {qd.quality && !grades.some(g => {
                               const clean = (s) => (s || '').trim().replace(/\.$/, '').toUpperCase();
                               return clean(g.grade_name) === clean(qd.quality) || clean(g.grade_code) === clean(qd.quality);
                             }) && (
                               <option value={qd.quality}>{qd.quality}</option>
                             )}
                             {grades.map(g => <option key={g.grade_code} value={g.grade_name}>{g.grade_name}</option>)}
                          </select>
                       </div>
                       <div className="col-span-2">
                          <input type="number" name="qty" className="w-full bg-white border border-gray-400 p-0.5 text-xs text-right" value={qd.qty || ''} onChange={(e) => handleQualityChange(i, e)} placeholder="Qty" />
                       </div>
                       <div className="col-span-3">
                          <input 
                             type="text" 
                             name="agency" 
                             className="w-full bg-white border border-gray-400 p-0.5 text-xs font-bold uppercase" 
                             value={qd.agency || ''} 
                             onChange={(e) => handleQualityChange(i, e)} 
                             list="agency_card_list"
                             placeholder="Agency" 
                          />
                       </div>
                       <div className="col-span-2">
                          <input 
                             type="text" 
                             name="marka" 
                             className="w-full bg-white border border-gray-400 p-0.5 text-xs font-bold uppercase" 
                             value={qd.marka || ''} 
                             onChange={(e) => handleQualityChange(i, e)} 
                             list="marka_list_options"
                             placeholder="Marka" 
                          />
                       </div>
                       <div className="col-span-2">
                          <input type="number" name="rs" className="w-full bg-white border border-gray-400 p-0.5 text-xs text-right" value={qd.rs || ''} onChange={(e) => handleQualityChange(i, e)} placeholder="Rs." />
                       </div>
                    </div>
                 ))}
                 <datalist id="marka_list_options">
                    {markas.map((m: any, idx: number) => (
                       <option key={idx} value={m.marka_name} />
                    ))}
                  </datalist>
                  <datalist id="agency_card_list">
                     {agencies.map((a: any, idx: number) => (
                        <option key={idx} value={a.agency_name} />
                     ))}
                  </datalist>
              </LegacyFieldset>

              <LegacyFieldset legend="Shipment & Claims">
                 <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-1 items-center">
                    <div className="col-span-4 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Shipment</label>
                       <input type="date" name="shipment_date" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.shipment_date} onChange={handleChange} />
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-12 shrink-0">Days</label>
                       <input type="number" name="shipment_days" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.shipment_days} onChange={handleChange} />
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-16 shrink-0">Penalty/Day</label>
                       <input type="number" name="shipment_penalty" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.shipment_penalty} onChange={handleChange} />
                    </div>

                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Marks Claim</label>
                       <input type="number" name="marks_claim" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.marks_claim} onChange={handleChange} />
                    </div>
                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Quantity Claim</label>
                       <input type="number" name="quantity_claim" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right" value={formData.quantity_claim} onChange={handleChange} />
                    </div>
                 </div>
              </LegacyFieldset>

              <LegacyFieldset legend="Remarks & Finalisation">
                 <div className="grid grid-cols-12 gap-x-4 gap-y-3 mt-1 items-center">
                    <div className="col-span-12 flex flex-col gap-2">
                       <label className="text-[11px] font-bold text-gray-700">Remarks</label>
                       <textarea name="remarks" className="w-full bg-white border border-gray-400 p-1 text-xs outline-none" rows={2} value={formData.remarks} onChange={handleChange} />
                    </div>
                    
                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">B. Rate (Rs.)</label>
                       <input type="number" name="b_rate" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs text-right text-red-700 font-bold" value={formData.b_rate} onChange={handleChange} />
                    </div>
                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">B. Date</label>
                       <input type="date" name="b_date" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.b_date} onChange={handleChange} />
                    </div>

                    <div className="col-span-6 flex items-center gap-2">
                       <label className="text-[11px] font-bold w-24 shrink-0">Superior/Normal</label>
                       <input type="text" name="superior_normal_marks" className="flex-1 bg-white border border-gray-400 p-0.5 text-xs" value={formData.superior_normal_marks} onChange={handleChange} />
                    </div>
                 </div>
              </LegacyFieldset>
           </div>
        </div>

        {/* Footer Ribbon */}
        <div className="flex bg-[#c0c0c0] p-1 border border-black/20 gap-1 mt-2">
           <LegacyButton icon={Plus} label="New (F2)" />
           <div className="flex-1" />
           <LegacyButton icon={Printer} label="Print" />
           <LegacyButton icon={X} label="Back (Esc)" onClick={onCancel} />
           <LegacyButton icon={Save} label={loading ? "SAVING..." : "SAVE CONTRACT"} active={!loading} onClick={handleSave} />
        </div>
      </div>
    </LegacyLayout>
  );
}

function ComboField({ label, name, value, onChange, options }: any) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (inputRef.current) {
      inputRef.current.focus();
      try {
        if (typeof (inputRef.current as any).showPicker === 'function') {
          (inputRef.current as any).showPicker();
        }
      } catch (err) {
        console.warn('showPicker not supported or failed', err);
      }
    }
  };

  return (
    <div className="col-span-12 flex items-center gap-2 relative">
       <label className="text-[11px] font-bold w-24 shrink-0">{label}</label>
       <div className="flex-1 flex gap-px border border-gray-400 bg-white">
          <input 
             ref={inputRef}
             name={name}
             value={value}
             onChange={onChange}
             list={`${name}_list`}
             className="flex-1 text-xs px-2 py-0.5 outline-none font-bold uppercase" 
             placeholder={`SELECT OR TYPE ${label.toUpperCase()}...`} 
          />
          <datalist id={`${name}_list`}>
             {options?.map((opt: string, i: number) => <option key={i} value={opt} />)}
          </datalist>
          <button 
             type="button"
             tabIndex={-1}
             onClick={handleButtonClick}
             className="bg-[#d4d0c8] px-2 border-l border-gray-400 hover:bg-white"
          >
             <ChevronDown className="h-4 w-4" />
          </button>
       </div>
    </div>
  )
}
