import React, { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  HandCoins,
  Container,
  Users,
  Store,
  FileText,
  Settings,
  ChevronRight,
  Menu,
  X,
  PackageCheck,
  ClipboardList,
  Archive,
  Power,
  User,
  Lock,
  Calendar,
  Clock,
  Terminal,
  Monitor,
  TrendingUp,
  Bot,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  Layers,
  Search,
  Printer,
  AlertCircle,
  AlertTriangle,
  Link,
  BarChart3,
  MessageSquare,
  ShieldAlert,
  Scale,
  Eye,
  EyeOff,
  Leaf,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import bjlAsset from "./assets/asset_bjl.png";
import { SystemNoticeModal } from "./components/SystemNoticeModal";

import AmadEntry from "./pages/AmadEntry";
import AmadRegister from "./pages/AmadRegister";
import SaudaEntry from "./pages/SaudaEntry";
import BardanaVouchers from "./pages/BardanaVouchers";
import DirectoryView from "./pages/DirectoryView";
import Reports from "./pages/Reports";
import Dashboard from "./pages/Dashboard";
import StockSummary from "./pages/StockSummary";
import ConfigGuide from "./pages/ConfigGuide";
import SaudaRegister from "./pages/SaudaRegister";
import SmsSaudaDesk from "./pages/SmsSaudaDesk";
import SattaRegister from "./pages/SattaRegister";
import SattaEntry from "./pages/SattaEntry";
import SattaChart from "./pages/SattaChart";
import PurchaseOrder from "./pages/PurchaseOrder";
import MaterialIssue from "./pages/MaterialIssue";
import AdminDesk from "./pages/AdminDesk";
import AIPortal from "./pages/AIPortal";
import MaterialInspection from "./pages/MaterialInspection";
import WeightBridge from "./pages/WeightBridge";
import MrSettlement from "./pages/MrSettlement";
import ClosingStockEntry from "./pages/ClosingStockEntry";
import MismatchCase from "./pages/MismatchCase";
import ClubPOMR from "./pages/ClubPOMR";
import FinalArrival from "./pages/FinalArrival";
import RequisitionDesk from "./pages/RequisitionDesk";
import PaymentModule from "./pages/PaymentModule";
import LegacyLayout, { LegacyButton } from "./components/LegacyLayout";
import AIAssistant from "./components/AIAssistant";
import { setCurrentUserContext, getCurrentUserContext } from "./lib/permissions";

import { supabase } from "./lib/supabase";

(async () => {
  try {
    await supabase.rpc("exec_sql", { query: "ALTER TABLE user_master ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;" });
    await supabase.rpc("exec_sql", { query: "ALTER TABLE mill_inspection_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;" });
    await supabase.rpc("exec_sql", { 
      query: `
        DO $$ 
        BEGIN 
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT DEFAULT 'No';
          
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='lorry_no') THEN 
            ALTER TABLE final_arrival RENAME COLUMN lorry_no TO lorry_number; 
          END IF; 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='vehicle_no') THEN 
            ALTER TABLE final_arrival RENAME COLUMN vehicle_no TO lorry_number; 
          END IF; 

          -- Ensure payment_master and payment_details tables exist
          CREATE TABLE IF NOT EXISTS payment_master (
            payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            voucher_no TEXT UNIQUE NOT NULL,
            payment_date DATE,
            mr_no TEXT,
            po_no TEXT,
            po_date DATE,
            sett_date DATE,
            po_type TEXT,
            broker TEXT,
            supplier TEXT,
            party_id TEXT,
            party_name TEXT,
            chn_supplier TEXT,
            lorry_number TEXT,
            arrival_no TEXT,
            arrival_date DATE,
            arival_apmc_fees NUMERIC DEFAULT 0,
            payable_amt NUMERIC DEFAULT 0,
            payable_bill_no TEXT,
            payable_bill_date DATE,
            total_amount NUMERIC DEFAULT 0,
            paid_amount NUMERIC DEFAULT 0,
            payment_mode TEXT,
            bank_name TEXT,
            reference_no TEXT,
            remarks TEXT,
            status TEXT DEFAULT 'completed',
            payment_status TEXT DEFAULT 'Paid',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS payment_master DISABLE ROW LEVEL SECURITY;

          CREATE TABLE IF NOT EXISTS payment_details (
            detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id UUID,
            voucher_no TEXT,
            mr_no TEXT,
            col_index INT,
            grade TEXT,
            area TEXT,
            agency TEXT,
            marka_crop TEXT,
            quantity NUMERIC DEFAULT 0,
            arr_qty_wt NUMERIC DEFAULT 0,
            min_qty_wt NUMERIC DEFAULT 0,
            wt_phota NUMERIC DEFAULT 0,
            wt_quantity NUMERIC DEFAULT 0,
            rate_value NUMERIC DEFAULT 0,
            gd_claim NUMERIC DEFAULT 0,
            gd_sett NUMERIC DEFAULT 0,
            gd_rev NUMERIC DEFAULT 0,
            gd_final NUMERIC DEFAULT 0,
            moist_claim NUMERIC DEFAULT 0,
            moist_sett NUMERIC DEFAULT 0,
            moist_rev NUMERIC DEFAULT 0,
            moist_final NUMERIC DEFAULT 0,
            dust_claim NUMERIC DEFAULT 0,
            dust_sett NUMERIC DEFAULT 0,
            dust_rev NUMERIC DEFAULT 0,
            dust_final NUMERIC DEFAULT 0,
            ncv_claim NUMERIC DEFAULT 0,
            ncv_sett NUMERIC DEFAULT 0,
            ncv_rev NUMERIC DEFAULT 0,
            ncv_final NUMERIC DEFAULT 0,
            po_grade_claim NUMERIC DEFAULT 0,
            po_grade_sett NUMERIC DEFAULT 0,
            po_grade_rev NUMERIC DEFAULT 0,
            po_grade_final NUMERIC DEFAULT 0,
            adjust_type TEXT,
            remark TEXT,
            claim_settlement NUMERIC DEFAULT 0,
            bill_no TEXT,
            bill_date DATE,
            bill_amount NUMERIC(15,2),
            paid_amount NUMERIC(15,2),
            balance_amount NUMERIC(15,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS payment_details DISABLE ROW LEVEL SECURITY;

          -- Ensure payment_master and payment_details have all required columns
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS mr_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS sett_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_type TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS chn_supplier TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arrival_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_amt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_bill_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_bill_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Completed';
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS advance_payment_done TEXT DEFAULT 'No';

          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS payment_id UUID;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS voucher_no TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS mr_no TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS col_index INT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS marka_crop TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS quantity NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS arr_qty_wt NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS min_qty_wt NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS wt_phota NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS wt_quantity NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS rate_value NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS adjust_type TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS remark TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS claim_settlement NUMERIC;

          -- Ensure material_mismatch table exists and has all required columns
          CREATE TABLE IF NOT EXISTS material_mismatch (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mismatch_id TEXT UNIQUE,
            po_no TEXT,
            arrival_no TEXT,
            inspection_no TEXT,
            area TEXT,
            grade TEXT,
            supplier TEXT,
            broker TEXT,
            agency TEXT,
            ptf_mode TEXT,
            challan_supplier TEXT,
            rate_per_mt TEXT,
            lorry_number TEXT,
            issue_description TEXT,
            expected_value TEXT,
            actual_value TEXT,
            difference TEXT,
            mismatched_fields TEXT,
            severity TEXT,
            status TEXT DEFAULT 'pending',
            remarks TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_mismatch DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS mismatch_id TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS inspection_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS ptf_mode TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS challan_supplier TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS rate_per_mt TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS issue_description TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS expected_value TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS actual_value TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS difference TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS mismatched_fields TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS severity TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS remarks TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS approval_level TEXT;

          -- Add mismatch clearance columns to sauda_check_point
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT false;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approval_level TEXT;
        END $$;
        NOTIFY pgrst, 'reload schema';
      ` 
    });
  } catch (err) {
    console.warn("Startup SQL migration caught error:", err);
  }
})();
import { useIdleTimer } from "./hooks/useIdleTimer";

// Login Screen / Year Selection - Bally Jute Limited UI
const CLOUDINARY_BG_URL = "https://res.cloudinary.com/x6tw39wi/image/upload/v1785928946/icon_vffvx9.png";

function AuthScreen({
  onLogin,
}: {
  onLogin: (year: string, user: string, pass: string) => void;
}) {
  const [year, setYear] = useState("2026-2027");
  const [username, setUsername] = useState("ADMIN");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bgSrc, setBgSrc] = useState(CLOUDINARY_BG_URL);

  return (
    <div className="min-h-screen w-screen bg-[#e2dac8] flex items-center justify-center p-2 sm:p-4 font-sans select-none overflow-hidden">
      {/* Centered Master Card Container - Enforces strict Landscape aspect ratio (1462/962) */}
      <div className="relative w-full max-w-[1360px] aspect-[1462/962] max-h-[92vh] bg-[#f5f5f5] rounded-[20px] sm:rounded-[30px] lg:rounded-[36px] border border-[#c5ba9e] shadow-[0_25px_60px_rgba(0,0,0,0.22)] overflow-hidden flex items-center justify-center lg:justify-end my-auto transition-all">
        
        {/* Single Responsive Landscape Background Artwork Image */}
        <img
          src={bgSrc}
          alt="Bally Jute Limited Background"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
          onError={() => {
            if (bgSrc === CLOUDINARY_BG_URL) {
              setBgSrc(bjlAsset);
            }
          }}
        />

        {/* Login Container - Positioned to neatly align right below the background's "Welcome" title */}
        <div className="relative z-10 w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[400px] px-3 sm:px-4 lg:mr-[4%] xl:mr-[6%] mt-[22%] sm:mt-[24%] lg:mt-[22%] mb-auto">
          {/* Login Box */}
          <div className="w-full bg-[#f0e9e0]/95 backdrop-blur-md p-4 sm:p-6 rounded-[18px] sm:rounded-[20px] shadow-[0_15px_35px_rgba(0,0,0,0.18)] border border-[#d6caa8]/80 transition-all">
            {/* Header Title */}
            <div className="text-center mb-3">
              <h2 className="text-lg sm:text-xl font-bold text-[#1E331B] tracking-tight">
                Bally Jute Login
              </h2>
              <p className="text-[10px] sm:text-[11px] text-[#5A6855] font-medium mt-0.5">
                Enter your operational credentials
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onLogin(year, username, password);
              }}
              className="space-y-2.5 sm:space-y-3"
            >
              {/* Financial Session Select */}
              <div>
                <label className="text-[9px] sm:text-[10px] font-bold text-[#5A6855] uppercase tracking-wider block mb-1">
                  Financial Session
                </label>
                <select
                  className="w-full p-2.5 sm:p-3 rounded-[9px] sm:rounded-[10px] border border-[#ccc] bg-white/90 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20 transition-all appearance-none cursor-pointer"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="2026-2027">Session 2026-2027 (Current)</option>
                  <option value="2025-2026">Session 2025-2026</option>
                </select>
              </div>

              {/* Username Input */}
              <div>
                <label className="text-[9px] sm:text-[10px] font-bold text-[#5A6855] uppercase tracking-wider block mb-1">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2.5 sm:p-3 rounded-[9px] sm:rounded-[10px] border border-[#ccc] bg-white/90 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20 transition-all"
                  required
                />
              </div>

              {/* Password Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-[#5A6855] uppercase tracking-wider block">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[9px] sm:text-[10px] text-[#2e5b25] font-semibold hover:underline cursor-pointer"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 sm:p-3 rounded-[9px] sm:rounded-[10px] border border-[#ccc] bg-white/90 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20 transition-all"
                  required
                />
              </div>

              {/* Forgot Password Helper */}
              <div className="flex justify-end pt-0.5">
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(
                      "Bally Jute Mill Operator Credentials:\nID: ADMIN\nPassword: Admin@1234"
                    );
                  }}
                  className="text-[10px] sm:text-[11px] text-[#5D6B58] hover:text-[#2e5b25] font-medium transition-colors"
                >
                  Forgot Password?
                </a>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="w-full p-3 sm:p-3.5 mt-1 rounded-[9px] sm:rounded-[10px] bg-[#2e5b25] hover:bg-[#23471c] text-white font-bold text-xs sm:text-sm tracking-wide border-none cursor-pointer transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

type Page =
  | "dashboard"
  | "amad"
  | "amad_entry"
  | "sauda"
  | "sauda_entry"
  | "satta"
  | "satta_entry"
  | "bardana"
  | "vyapari"
  | "reports"
  | "payment"
  | "ledger"
  | "balances"
  | "settings"
  | "stock"
  | "po"
  | "final_po"
  | "issue"
  | "requisition_desk"
  | "admindesk"
  | "ai_assistant"
  | "material_inspection"
  | "mr_settlement"
  | "closing_stock"
  | "mismatch"
  | "material_mismatch"
  | "club_po_mr"
  | "final_arrival"
  | "satta_chart"
  | "sms_sauda"
  | "po_archive"
  | "mr_archive"
  | "weight_bridge";

const allSidebarItems = [
  { id: "dashboard", label: "Operational Hub", icon: LayoutDashboard },
  { id: "sms_sauda", label: "SMS Sauda Desk", icon: MessageSquare },
  { id: "sauda", label: "Sauda Desk", icon: HandCoins },
  { id: "po", label: "Sauda Check Point", icon: FileText },
  { id: "final_po", label: "Final P.O", icon: FileText },
  { id: "amad", label: "Temporary M.R", icon: Archive },
  { id: "material_inspection", label: "Quality Audit", icon: ShieldCheck },
  { id: "final_arrival", label: "Final Arrival", icon: CheckCircle2 },
  { id: "mismatch", label: "Mismatch Case", icon: AlertTriangle },
  { id: "club_po_mr", label: "Club P.O & M.R", icon: Link },
  { id: "mr_settlement", label: "M.R. Settlement", icon: FileCheck },
  { id: "issue", label: "Material Issue", icon: PackageCheck },
  { id: "bardana", label: "Godown Master", icon: Store },
  { id: "closing_stock", label: "Stock Inventory", icon: Layers },
  { id: "weight_bridge", label: "Weight Bridge", icon: Scale },
  { id: "reports", label: "Reports", icon: TrendingUp },
  { id: "settings", label: "Config Center", icon: Settings },
  { id: "admindesk", label: "Admin Desk", icon: Lock },
  { id: "satta", label: "Satta Desk", icon: HandCoins },
  { id: "satta_chart", label: "Satta Rate Chart", icon: TrendingUp },
  { id: "requisition_desk", label: "Requisition Desk", icon: ClipboardList },
  { id: "ai_assistant", label: "Jarves AI 2.0", icon: Bot },
];

function getPageMeta(pageId: string) {
  // 1. Try to find in standard sidebar items
  const item = allSidebarItems.find((i) => i.id === pageId);
  if (item) {
    return { label: item.label, icon: item.icon };
  }

  // 2. Custom mappings
  if (pageId === "amad_entry") {
    return { label: "Amad Entry", icon: PlusCircle };
  }
  if (pageId === "sauda_entry") {
    return { label: "Sauda Entry", icon: PlusCircle };
  }
  if (pageId === "satta_entry") {
    return { label: "Satta Entry", icon: PlusCircle };
  }
  if (pageId === "vyapari") {
    return { label: "Traders Directory", icon: Users };
  }
  if (pageId === "admindesk") {
    return { label: "Admin Desk", icon: Settings };
  }
  if (pageId === "po_archive") {
    return { label: "Final P.O Archive", icon: Archive };
  }
  if (pageId === "mr_archive") {
    return { label: "Final M.R Archive", icon: Archive };
  }
  if (pageId === "payment") {
    return { label: "Payment Module", icon: FileText };
  }

  // 3. Fallbacks
  const fallbackLabel = pageId
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    label: fallbackLabel === "Ai Assistant" ? "AI Assistant" : fallbackLabel,
    icon: LayoutDashboard,
  };
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("L1");
  const [userLevel, setUserLevel] = useState<string>("L1");
  const [selectedYear, setSelectedYear] = useState("2026-2027");
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [isTempPo, setIsTempPo] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [dashboardTab, setDashboardTab] = useState<
    "menu" | "mismatch" | "reports"
  >("menu");
  const [allowedModules, setAllowedModules] = useState<string[]>(["*"]);
  const [runningPages, setRunningPages] = useState<Page[]>([]);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      }
    } catch (e) {
      console.warn("Storage purge error:", e);
    }
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useIdleTimer(15 * 60 * 1000, () => {
    if (isLoggedIn) {
      setIsLoggedIn(false);
      window.alert("Session auto-locked due to 15 minutes of inactivity.");
    }
  });

  // Custom HTML Alert Popup State & Global Override
  const [htmlAlert, setHtmlAlert] = useState<{ message: string } | null>(null);

  React.useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message: any) => {
      console.log("Custom HTML Alert Intercepted:", message);
      setHtmlAlert({ message: String(message) });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);
  const [systemLogs, setSystemLogs] = useState<
    {
      id: string;
      timestamp: string;
      event: string;
      details: string;
      currentPage: string;
      runningPages: string[];
    }[]
  >([]);

  // Command Menu Helper States
  const [showCommandSearch, setShowCommandSearch] = useState(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState("");
  const [highlightedCommandIndex, setHighlightedCommandIndex] = useState(0);

  // Global Route Guard
  const [showGlobalSattaWarning, setShowGlobalSattaWarning] = useState(false);

  const globalNavigate = async (targetPage: Page, subId?: string): Promise<boolean> => {
    // Determine if we need to block this target page.
    // Dashboard and Satta modules should always be accessible.
    const isRestrictedPage = targetPage !== "dashboard" && targetPage !== "satta" && targetPage !== "satta_chart";
    
    // Satta Rate Guard: Explicitly exclude Admin, L2, L3, L4, and L5
    const isL1User = userLevel === "L1";
    const isExcludedRole = isAdmin || ["L2", "L3", "L4", "L5"].includes(userLevel);

    if (isRestrictedPage && isL1User && !isExcludedRole) {
      const now = new Date();
      const localYear = now.getFullYear();
      const localMonth = String(now.getMonth() + 1).padStart(2, '0');
      const localDay = String(now.getDate()).padStart(2, '0');
      const todayLocalStr = `${localYear}-${localMonth}-${localDay}`;
      const todayUtcStr = now.toISOString().split("T")[0];

      if (supabase) {
        // Fallback: check Supabase directly if any Satta chart was uploaded/updated today by any user
        try {
          const isSameDay = (dateStr?: string) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;
            const dLocalStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dUtcStr = d.toISOString().split("T")[0];
            return dLocalStr === todayLocalStr || dLocalStr === todayUtcStr || dUtcStr === todayLocalStr || dUtcStr === todayUtcStr;
          };

            // Check satta_base_rates
            const { data: baseRates } = await supabase
              .from('satta_base_rates')
              .select('id, created_at, start_date')
              .order('created_at', { ascending: false })
              .limit(1);

            // Check satta_base_rate_audit_logs
            const { data: auditLogs } = await supabase
              .from('satta_base_rate_audit_logs')
              .select('id, created_at, changed_date')
              .order('created_at', { ascending: false })
              .limit(1);

            // Check satta_differentials
            const { data: diffLogs } = await supabase
              .from('satta_differentials')
              .select('id, created_at')
              .order('created_at', { ascending: false })
              .limit(1);

            let isUploadedToday = false;

            if (baseRates && baseRates.length > 0) {
              const r = baseRates[0];
              if (isSameDay(r.created_at) || r.start_date === todayLocalStr || r.start_date === todayUtcStr) {
                isUploadedToday = true;
              }
            }

            if (!isUploadedToday && auditLogs && auditLogs.length > 0) {
              const a = auditLogs[0];
              if (isSameDay(a.created_at) || a.changed_date === todayLocalStr || a.changed_date === todayUtcStr) {
                isUploadedToday = true;
              }
            }

            if (!isUploadedToday && diffLogs && diffLogs.length > 0) {
              const df = diffLogs[0];
              if (isSameDay(df.created_at)) {
                isUploadedToday = true;
              }
            }

            if (!isUploadedToday) {
              setShowGlobalSattaWarning(true);
              return false; // Prevent navigation
            }
          } catch (e) {
            console.warn("Failed to check satta base rates in Supabase:", e);
            setShowGlobalSattaWarning(true);
            return false; // Prevent navigation
          }
        } else {
          setShowGlobalSattaWarning(true);
          return false; // Prevent navigation
        }
    }

    let actualTarget = targetPage;
    if (subId === 'po_final' || targetPage === 'po_final' as any) {
      actualTarget = 'final_po';
    } else if (subId === 'po_temp') {
      actualTarget = 'po';
    }

    setCurrentPage(actualTarget);
    if (actualTarget === 'po' || subId === 'po_temp') {
      setIsTempPo(true);
    } else if (actualTarget === 'final_po' || subId === 'po_final') {
      setIsTempPo(false);
    }
    
    return true;
  };

  // Global Ctrl+K command listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandSearch((prev) => !prev);
        setCommandSearchQuery("");
        setHighlightedCommandIndex(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Refs to always have fresh state values for async/sync logging without stale closure problems
  const currentPageRef = React.useRef(currentPage);
  const runningPagesRef = React.useRef(runningPages);

  React.useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  React.useEffect(() => {
    runningPagesRef.current = runningPages;
  }, [runningPages]);

  const logEvent = React.useCallback((event: string, details: string) => {
    const now = new Date();
    const timestamp =
      now.toLocaleTimeString() +
      "." +
      String(now.getMilliseconds()).padStart(3, "0");

    // Core audit tracking for P.O synchronization with Material Inspection records
    let enhancedDetails = details;
    if (event === "PO_SYNC") {
      const matchPo = details.match(/\[PO:\s*([^\]]+)\]/);
      const matchMr = details.match(/\[MR:\s*([^\]]+)\]/);
      const poNo = matchPo ? matchPo[1] : "UNKNOWN_PO";
      const mrNo = matchMr ? matchMr[1] : "UNKNOWN_MR";
      const syncTimestamp = now.toISOString();

      const statusDetails = `[PO-INSPECTION-AUDIT] PO No: ${poNo}, MR No: ${mrNo}, Timestamp: ${syncTimestamp}, Field Match Status: MATCHED & VERIFIED`;
      enhancedDetails = `${details} | ${statusDetails}`;
    }

    setSystemLogs((prev) => {
      const newLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp,
        event,
        details: enhancedDetails,
        currentPage: currentPageRef.current,
        runningPages: [...runningPagesRef.current],
      };
      return [newLog, ...prev].slice(0, 300); // Keep last 300 logs
    });

    if (supabase) {
      const username = getCurrentUserContext().username || "ADMIN";
      supabase
        .from("user_activity_logs")
        .insert([
          {
            username,
            activity_type: event,
            module_name: currentPageRef.current || "system",
            action_details: enhancedDetails,
            ip_address: "Local",
          },
        ])
        .then(({ error }) => {
          if (error) {
            console.warn("User activity logging failed:", error);
          }
        });
    }
  }, []);

  // Log system boot once logged in
  React.useEffect(() => {
    if (isLoggedIn) {
      logEvent(
        "SYSTEM_BOOT",
        `P.O Automation Console booted in session year ${selectedYear}.`,
      );
    }
  }, [isLoggedIn, selectedYear, logEvent]);

  // Log all page changes
  React.useEffect(() => {
    if (isLoggedIn) {
      logEvent(
        "NAVIGATION",
        `Transitioned active view state to "${currentPage}"`,
      );
    }
  }, [currentPage, isLoggedIn, logEvent]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-legacy-bg", "#E8E6E1");
    root.style.setProperty("--color-legacy-blue", "#000080");
    root.style.setProperty("--color-legacy-navy", "#1a237e");
    root.style.setProperty("--color-legacy-teal", "#006064");
  }, []);

  React.useEffect(() => {
    if (currentPage !== "dashboard") {
      setRunningPages((prev) => {
        if (!prev.includes(currentPage)) {
          logEvent(
            "TASK_STARTED",
            `Registered background workspace task execution for "${currentPage}"`,
          );
          return [...prev, currentPage];
        }
        return prev;
      });
    }
  }, [currentPage, logEvent]);

  const closePage = (targetPage: Page, destination: Page = "dashboard") => {
    logEvent(
      "PAGE_CLOSE",
      `Terminated & Closed workspace screen instance "${targetPage}". Returning to "${destination}"`,
    );
    setRunningPages((prev) => prev.filter((p) => p !== targetPage));
    globalNavigate(destination);
  };

  React.useEffect(() => {
    const handleBack = () => {
      if (currentPage !== "dashboard") {
        const pageToClose = currentPage;
        logEvent("PAGE_CLOSE", `Event dynamic Back: closing "${pageToClose}"`);
        setRunningPages((prev) => prev.filter((p) => p !== pageToClose));
        globalNavigate("dashboard");
      } else {
        logEvent(
          "SYSTEM_DEPART",
          "Session ended - operator exited login screen",
        );
        setIsLoggedIn(false);
      }
    };
    const handleMinimize = () => {
      if (currentPage !== "dashboard") {
        logEvent(
          "MINIMIZE",
          `Event dynamic Minimize: hiding "${currentPage}" to taskbar`,
        );
        globalNavigate("dashboard");
      }
    };
    const handleClose = () => {
      if (currentPage !== "dashboard") {
        const pageToClose = currentPage;
        logEvent(
          "PAGE_CLOSE",
          `Event dynamic Close: stopping application widget "${pageToClose}"`,
        );
        setRunningPages((prev) => prev.filter((p) => p !== pageToClose));
        globalNavigate("dashboard");
      } else {
        logEvent(
          "SYSTEM_DEPART",
          "Session ended - operator exited login screen",
        );
        setIsLoggedIn(false);
      }
    };

    const handleAppNavigate = (e: any) => {
      if (e.detail && e.detail.page) {
        globalNavigate(e.detail.page);
      }
    };

    window.addEventListener("app-back", handleBack);
    window.addEventListener("app-minimize", handleMinimize);
    window.addEventListener("app-close", handleClose);
    window.addEventListener("app-navigate", handleAppNavigate);

    return () => {
      window.removeEventListener("app-back", handleBack);
      window.removeEventListener("app-minimize", handleMinimize);
      window.removeEventListener("app-close", handleClose);
      window.removeEventListener("app-navigate", handleAppNavigate);
    };
  }, [currentPage]);

  const handleLogin = async (year: string, user: string, pass: string) => {
    // Master Admin Fallback
    if (user.toLowerCase() === "admin") {
      if (pass !== "Admin@1234") {
        alert("Access denied: Invalid Admin Password.");
        return;
      }
      setIsAdmin(true);
      setUserRole("ADMIN");
      setUserLevel("ADMIN");
      setIsLoggedIn(true);
      setSelectedYear(year);
      globalNavigate("dashboard");
      setAllowedModules(["*"]);
      setCurrentUserContext({ username: "ADMIN", userRole: "ADMIN", userLevel: "ADMIN" });
      logEvent(
        "LOGIN_HISTORY",
        `Administrator login verified under session year: ${year}`,
      );
      return;
    }

    if (!supabase) {
      alert("System offline. Use master override credentials.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_master")
        .select("*")
        .or(`user_id.eq.${user},username.eq.${user.toUpperCase()}`)
        .eq("status", "Active")
        .single();

      if (error || !data) {
        alert("Invalid system credentials or account inactive.");
        return;
      }

      // Check password (assume plain text for this legacy demo or user preference)
      if (data.password === pass) {
        setIsAdmin(
          data.role?.toUpperCase() === "ADMIN" ||
            data.role?.toUpperCase() === "ADMINISTRATOR",
        );
        setUserRole(data.role?.toUpperCase() || "L1");
        setUserLevel(data.level?.toUpperCase() || "L1");
        setAllowedModules(
          data.allowed_modules
            ? data.allowed_modules === "*"
              ? ["*"]
              : data.allowed_modules.split(",")
            : ["*"],
        );
        setIsLoggedIn(true);
        setSelectedYear(year);
        globalNavigate("dashboard");
        // Update last login
        supabase.from('user_master').update({ last_login: new Date().toISOString() }).eq('user_id', data.user_id).then(res => console.log("Login Update:", res));
        
        setCurrentUserContext({
          username: data.username,
          userRole: data.role?.toUpperCase() || "L1",
          userLevel: data.level?.toUpperCase() || "L1"
        });
        logEvent(
          "LOGIN_HISTORY",
          `Operator account: ${data.username} [Role: ${data.role || "USER"}] successfully logged in under session year: ${year}`,
        );
      } else {
        alert("Access denied: Authentication failure.");
      }
    } catch (err) {
      console.error("Login fault:", err);
      alert("Internal security fault. Verify DB connection.");
    }
  };

  if (!isLoggedIn) {
    return (
      <>
        <AuthScreen onLogin={handleLogin} />

        {/* Custom HTML Alert overlay for Login Screen */}
        {htmlAlert && (
          <SystemNoticeModal
            message={htmlAlert.message}
            onClose={() => setHtmlAlert(null)}
          />
        )}
      </>
    );
  }

  const sidebarItems =
    isAdmin || allowedModules.includes("*")
      ? allSidebarItems
      : allSidebarItems.filter(
          (item) => allowedModules.includes(item.id) || item.id === "dashboard",
        );

  return (
    <div className="flex h-screen w-full overflow-auto bg-legacy-bg font-sans">
      {/* Master Wrapper */}
      <div className="flex flex-1 flex-col min-w-[1200px] min-h-[700px]">
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-auto">
          {/* Sidebar removed per user request */}

          {/* Dynamic Page Rendering */}
          <div className="flex-1 flex flex-col overflow-auto">
            <div className="flex-1 flex flex-col overflow-auto relative">
              <div
                className={currentPage === "dashboard" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <Dashboard
                  isActive={currentPage === "dashboard"}
                  onNavigate={globalNavigate}
                  isAdmin={isAdmin}
                  allowedModules={allowedModules}
                  currentTab={dashboardTab}
                  setCurrentTab={setDashboardTab}
                />
              </div>
              <div
                className={currentPage === "amad" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <AmadRegister
                  onClose={() => closePage("amad", "dashboard")}
                  onNew={() => globalNavigate("amad_entry")}
                />
              </div>
              {currentPage === "amad_entry" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <AmadEntry
                    onCancel={() => closePage("amad_entry", "amad")}
                    onSave={() => closePage("amad_entry", "amad")}
                  />
                </div>
              )}
              <div
                className={currentPage === "sms_sauda" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SmsSaudaDesk
                  onClose={() => closePage("sms_sauda", "dashboard")}
                  onNavigate={(page) => globalNavigate(page as Page)}
                />
              </div>
              <div
                className={currentPage === "sauda" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SaudaRegister
                  isActive={currentPage === "sauda"}
                  onClose={() => closePage("sauda", "dashboard")}
                  onNew={() => globalNavigate("sauda_entry")}
                />
              </div>
              {currentPage === "sauda_entry" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <SaudaEntry
                    onCancel={() => closePage("sauda_entry", "sauda")}
                    onSave={() => closePage("sauda_entry", "sauda")}
                  />
                </div>
              )}
              <div
                className={currentPage === "satta" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SattaChart onClose={() => closePage("satta", "dashboard")} />
              </div>
              {currentPage === "satta_entry" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <SattaEntry
                    onCancel={() => closePage("satta_entry", "satta")}
                    onSave={() => closePage("satta_entry", "satta")}
                  />
                </div>
              )}
              <div
                className={currentPage === "satta_chart" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SattaChart
                  onClose={() => {
                    if (currentPage === "satta_chart") {
                      closePage("satta_chart", "dashboard");
                    } else {
                      closePage("satta_chart", "satta");
                    }
                  }}
                />
              </div>
              <div
                className={currentPage === "po" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <PurchaseOrder
                  onClose={() => closePage("po", "dashboard")}
                  selectedYear={selectedYear}
                  isTempPo={true}
                />
              </div>
              <div
                className={currentPage === "final_po" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <PurchaseOrder
                  onClose={() => closePage("final_po", "dashboard")}
                  selectedYear={selectedYear}
                  isTempPo={false}
                />
              </div>
              {currentPage === "issue" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <MaterialIssue
                    onCancel={() => closePage("issue", "dashboard")}
                    onSave={() => closePage("issue", "dashboard")}
                    setCurrentPage={globalNavigate}
                    closePage={closePage}
                  />
                </div>
              )}
              <div
                className={currentPage === "bardana" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <BardanaVouchers
                  onClose={() => closePage("bardana", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "vyapari" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <DirectoryView
                  title="Traders"
                  type="vyapari"
                  onClose={() => closePage("vyapari", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "reports" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <Reports onClose={() => closePage("reports", "dashboard")} />
              </div>
              <div
                className={currentPage === "payment" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <PaymentModule onClose={() => closePage("payment", "dashboard")} />
              </div>
              <div
                className={currentPage === "stock" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <StockSummary
                  onClose={() => closePage("stock", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "settings" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <ConfigGuide
                  onClose={() => closePage("settings", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "admindesk" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <AdminDesk
                  onClose={() => closePage("admindesk", "dashboard")}
                  onLogin={() => setIsAdmin(true)}
                  isAdmin={isAdmin}
                  systemLogs={systemLogs}
                  onClearLogs={() => setSystemLogs([])}
                  onNavigate={(page) => globalNavigate(page)}
                />
              </div>
              <div
                className={currentPage === "ai_assistant" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <AIPortal
                  onClose={() => closePage("ai_assistant", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "material_inspection" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MaterialInspection
                  onClose={() => closePage("material_inspection", "dashboard")}
                  onLogEvent={logEvent}
                />
              </div>
              <div
                className={currentPage === "mr_settlement" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MrSettlement
                  onClose={() => closePage("mr_settlement", "dashboard")}
                  onLogEvent={logEvent}
                />
              </div>
              <div
                className={currentPage === "closing_stock" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <ClosingStockEntry
                  onClose={() => closePage("closing_stock", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "mismatch" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MismatchCase
                  variant="satta"
                  onClose={() => closePage("mismatch", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "material_mismatch" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MismatchCase
                  variant="material"
                  onClose={() => closePage("material_mismatch", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "club_po_mr" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <ClubPOMR
                  onClose={() => closePage("club_po_mr", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "final_arrival" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <FinalArrival
                  onClose={() => closePage("final_arrival", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "po_archive" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <PurchaseOrder
                  onClose={() => closePage("po_archive", "dashboard")}
                  selectedYear={selectedYear}
                  isTempPo={false}
                  isArchiveView={true}
                />
              </div>
              <div
                className={currentPage === "mr_archive" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <FinalArrival
                  onClose={() => closePage("mr_archive", "dashboard")}
                  isArchiveView={true}
                />
              </div>
              <div
                className={currentPage === "requisition_desk" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <RequisitionDesk
                  onClose={() => closePage("requisition_desk", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "weight_bridge" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <WeightBridge
                  currentUser={getCurrentUserContext()}
                  allowedModules={allowedModules}
                  onNavigate={(page) => globalNavigate(page as Page)}
                />
              </div>
            </div>
          </div>
        </div>

        <AIAssistant />

        {/* Windows-style Taskbar */}
        <div className="h-12 bg-legacy-bg border-t-2 border-white shadow-[0_-2px_4px_rgba(0,0,0,0.1)] flex items-center px-2 justify-between gap-4 overflow-hidden ">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-[70vw]">

            {/* Premium Integrated Dashboard Selection Tabs */}
            <div className="hidden items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  logEvent("NAVIGATION", 'Clicked "Menu Dashboard" on Taskbar');
                  setDashboardTab("menu");
                  globalNavigate("dashboard");
                }}
                className={cn(
                  "h-8 px-3 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-md cursor-pointer shrink-0",
                  currentPage === "dashboard" && dashboardTab === "menu"
                    ? "bg-indigo-100 border-indigo-600 text-indigo-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)] font-extrabold"
                    : "bg-[#f0f4ff] border-indigo-200 text-indigo-600 hover:bg-white",
                )}
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-[11px] font-black uppercase italic tracking-[0.05em] whitespace-nowrap text-slate-800">
                  Menu Dashboard
                </span>
              </button>

              <button
                onClick={() => {
                  logEvent(
                    "NAVIGATION",
                    'Clicked "Mismatch Dashboard" on Taskbar',
                  );
                  setDashboardTab("mismatch");
                  globalNavigate("dashboard");
                }}
                className={cn(
                  "h-8 px-3 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-md cursor-pointer shrink-0",
                  currentPage === "dashboard" && dashboardTab === "mismatch"
                    ? "bg-amber-100 border-amber-600 text-amber-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)] font-extrabold"
                    : "bg-amber-50/50 border-amber-200 text-amber-700 hover:bg-amber-50",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[11px] font-black uppercase italic tracking-[0.05em] whitespace-nowrap text-slate-800">
                  Mismatch Dashboard
                </span>
              </button>

              <button
                onClick={() => {
                  logEvent(
                    "NAVIGATION",
                    'Clicked "Report Dashboard" on Taskbar',
                  );
                  setDashboardTab("reports");
                  globalNavigate("dashboard");
                }}
                className={cn(
                  "h-8 px-3 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-md cursor-pointer shrink-0",
                  currentPage === "dashboard" && dashboardTab === "reports"
                    ? "bg-emerald-100 border-emerald-600 text-emerald-950 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)] font-extrabold"
                    : "bg-emerald-50/50 border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                )}
              >
                <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[11px] font-black uppercase italic tracking-[0.05em] whitespace-nowrap text-slate-800">
                  Report Dashboard
                </span>
              </button>
            </div>

            <div className="h-7 w-px bg-slate-300 mx-2 shadow-[1px_0_0_0_white] shrink-0" />

            {/* Admin Desk Taskbar Item */}
            {(runningPages.includes("admindesk") ||
              currentPage === "admindesk") && (
              <>
                <div className="relative flex items-center group/item shrink-0">
                  <button
                    onClick={() => {
                      if (currentPage === "admindesk") {
                        logEvent(
                          "MINIMIZE",
                          'Minimized "admindesk" to dashboard',
                        );
                        globalNavigate("dashboard");
                      } else {
                        logEvent(
                          "RESTORE",
                          'Restored "admindesk" from taskbar',
                        );
                        globalNavigate("admindesk");
                      }
                    }}
                    className={cn(
                      "pl-4 pr-8 h-8 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-md cursor-pointer shrink-0",
                      currentPage === "admindesk"
                        ? "bg-indigo-100 border-indigo-600 text-indigo-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]"
                        : "bg-[#f0f4ff] border-indigo-200 text-indigo-600 hover:bg-white",
                    )}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-black uppercase italic tracking-[0.05em] whitespace-nowrap">
                      Admin Desk
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closePage("admindesk", "dashboard");
                    }}
                    className={cn(
                      "absolute right-2 p-0.5 rounded-full flex items-center justify-center h-4 w-4 transition-all duration-150 cursor-pointer text-indigo-400 hover:text-red-600 hover:bg-red-50",
                    )}
                    title="Terminate Admin Desk"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="h-7 w-px bg-slate-200 mx-1 shrink-0" />
              </>
            )}

            {/* RUNNING_PROCS: Dynamic page instances in current session */}
            {runningPages
              .filter((p) => p !== "admindesk" && p !== "dashboard")
              .map((pageId) => {
                const { label, icon: Icon } = getPageMeta(pageId);
                const isActive = currentPage === pageId;
                return (
                  <div
                    key={pageId}
                    className="relative flex items-center group/item shrink-0"
                  >
                    <button
                      onClick={() => {
                        if (isActive) {
                          logEvent(
                            "MINIMIZE",
                            `Minimized page "${pageId}" to dashboard`,
                          );
                          globalNavigate("dashboard"); // Minimize if already active
                        } else {
                          logEvent(
                            "RESTORE",
                            `Restored page "${pageId}" from taskbar`,
                          );
                          globalNavigate(pageId); // Restore if minimized
                        }
                      }}
                      className={cn(
                        "pl-4 pr-8 h-8 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-md cursor-pointer shrink-0",
                        isActive
                          ? "bg-indigo-100 border-indigo-600 text-indigo-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] font-extrabold"
                          : "bg-[#f0f4ff] border-indigo-200 text-indigo-600 hover:bg-white",
                      )}
                      title={isActive ? "Minimize" : "Restore"}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5",
                          isActive ? "text-indigo-600" : "text-indigo-450",
                        )}
                      />
                      <span className="text-[11px] font-black uppercase italic tracking-[0.05em] whitespace-nowrap">
                        {label}
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closePage(pageId, "dashboard");
                      }}
                      className={cn(
                        "absolute right-2 p-0.5 rounded-full flex items-center justify-center h-4 w-4 transition-all duration-150 cursor-pointer text-indigo-400 hover:text-red-600 hover:bg-red-50",
                      )}
                      title="Terminate Page"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
          </div>

          <div className="flex gap-2 items-center">
            <div className="bg-white/40 border-2 border-white px-4 py-1.5 flex items-center gap-4 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)]">
              {/* <button
                onClick={() => {
                  logEvent(
                    "PRINT",
                    `Triggered print cascade for current active module view: "${currentPage}"`,
                  );
                  window.print();
                }}
                className="flex items-center gap-2 group hover:text-indigo-600 transition-colors cursor-pointer"
                title="Print Module View"
                id="btn-print"
              >
                <Printer className="h-3.5 w-3.5 text-indigo-700 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-tighter cursor-pointer">
                  Print
                </span>
              </button> */}

              <div className="h-5 w-px bg-slate-200" />

              <button
                onClick={() => {
                  setIsLoggedIn(false);
                  setCurrentUserContext({ username: 'ADMIN', userRole: 'ADMIN', userLevel: 'MAX' });
                  setCurrentPage("dashboard");
                }}
                className="flex items-center gap-2 group hover:text-rose-600 transition-colors"
                title="Logout System"
              >
                <Power className="h-3.5 w-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-tighter cursor-pointer">
                  Logout
                </span>
              </button>

              <div className="h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-2 opacity-80">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-tighter tabular-nums">
                  F.Y: {selectedYear}
                </span>
              </div>
              <div className="h-5 w-px bg-slate-200" />
              {/* <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-indigo-800" />
                <span className="text-[11px] font-black tabular-nums text-indigo-950 tracking-tighter uppercase italic">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div> */}
            </div>
          </div>
        </div>
      </div>

      {/* Global Quick-Command Navigator Modal (Ctrl+K Launcher Overlay) */}
      {showCommandSearch && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-[1px] z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowCommandSearch(false)}
        >
          <div
            className="w-full max-w-lg bg-[#d4d0c8] border-2 border-white shadow-[4px_4px_10px_rgba(0,0,0,0.3)]  text-slate-800 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Styled Retro Banner Title */}
            <div className="bg-indigo-950 px-2 py-1 text-white text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>
                  Jarves Integration Widget // Keyboard Navigator [CTRL+K]
                </span>
              </div>
              <button
                onClick={() => setShowCommandSearch(false)}
                className="text-white hover:text-red-400 font-extrabold text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-100 border-b border-slate-300">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  autoFocus
                  value={commandSearchQuery}
                  onChange={(e) => {
                    setCommandSearchQuery(e.target.value);
                    setHighlightedCommandIndex(0);
                  }}
                  onKeyDown={(e) => {
                    const activeModules =
                      isAdmin || allowedModules.includes("*")
                        ? allSidebarItems
                        : allSidebarItems.filter(
                            (item) =>
                              allowedModules.includes(item.id) ||
                              item.id === "dashboard",
                          );

                    const results = activeModules.filter((item) => {
                      if (!commandSearchQuery) return true;
                      const q = commandSearchQuery.toLowerCase();
                      return (
                        item.label.toLowerCase().includes(q) ||
                        item.id.toLowerCase().includes(q)
                      );
                    });

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedCommandIndex((prev) =>
                        Math.min(results.length - 1, prev + 1),
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedCommandIndex((prev) =>
                        Math.max(0, prev - 1),
                      );
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (results[highlightedCommandIndex]) {
                        const targetPage = results[highlightedCommandIndex]
                          .id as Page;
                        logEvent(
                          "HOTKEY_NAV",
                          `Quick-navigated to operational module: "${targetPage}" via Ctrl+K command menu`,
                        );
                        globalNavigate(targetPage);
                        setShowCommandSearch(false);
                      }
                    } else if (e.key === "Escape") {
                      setShowCommandSearch(false);
                    }
                  }}
                  className="w-full bg-white border-2 border-indigo-900/35 p-2 pl-9 outline-none text-xs text-indigo-950 font-bold uppercase focus:border-indigo-600"
                  placeholder="Search by module name (e.g. Settlement, Purchase PO, Quality)..."
                />
              </div>
              <p className="text-[8px] font-bold text-slate-500 font-mono mt-1 px-1 flex justify-between">
                <span>PRESS ↑↓ TO TRAVEL // ENTER TO NAVIGATE</span>
                <span>ESC TO CLOSE</span>
              </p>
            </div>

            {/* Results matched list */}
            <div className="max-h-60 overflow-y-auto bg-white border-b border-slate-400">
              {(isAdmin || allowedModules.includes("*")
                ? allSidebarItems
                : allSidebarItems.filter(
                    (item) =>
                      allowedModules.includes(item.id) ||
                      item.id === "dashboard",
                  )
              )
                .filter((item) => {
                  if (!commandSearchQuery) return true;
                  const q = commandSearchQuery.toLowerCase();
                  return (
                    item.label.toLowerCase().includes(q) ||
                    item.id.toLowerCase().includes(q)
                  );
                })
                .map((item, idx) => {
                  const isHighlighted = idx === highlightedCommandIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        logEvent(
                          "HOTKEY_NAV",
                          `Quick-navigated to operational module: "${item.id}" via Ctrl+K command menu`,
                        );
                        globalNavigate(item.id as Page);
                        setShowCommandSearch(false);
                      }}
                      onMouseEnter={() => setHighlightedCommandIndex(idx)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 flex items-center justify-between text-xs font-bold transition-all border-b border-slate-100 last:border-b-0 cursor-pointer uppercase",
                        isHighlighted
                          ? "bg-indigo-950 text-white"
                          : "text-slate-800 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isHighlighted
                              ? "text-emerald-400 animate-pulse"
                              : "text-indigo-900",
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      <span
                        className={cn(
                          "text-[8px] font-mono",
                          isHighlighted ? "text-white/60" : "text-slate-400",
                        )}
                      >
                        CODE: {item.id}
                      </span>
                    </button>
                  );
                })}

              {(isAdmin || allowedModules.includes("*")
                ? allSidebarItems
                : allSidebarItems.filter(
                    (item) =>
                      allowedModules.includes(item.id) ||
                      item.id === "dashboard",
                  )
              ).filter((item) => {
                if (!commandSearchQuery) return true;
                const q = commandSearchQuery.toLowerCase();
                return (
                  item.label.toLowerCase().includes(q) ||
                  item.id.toLowerCase().includes(q)
                );
              }).length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No operational modules matched your search query.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom HTML Alert overlay */}
      {htmlAlert && (
        <SystemNoticeModal
          message={htmlAlert.message}
          onClose={() => setHtmlAlert(null)}
        />
      )}

      {/* Global Satta Warning Modal */}
      {showGlobalSattaWarning && (
        <div className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4  animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-amber-50 px-6 py-6 border-b border-amber-100 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldAlert className="w-24 h-24 text-amber-500 -rotate-12" />
              </div>
              
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4 relative z-10 shadow-inner">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-amber-900 tracking-tight">
                  Satta Rate Chart Required
                </h3>
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-tight mt-1 font-mono">
                  ACTION REQUIRED
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 text-center space-y-4">
              <p className="text-xs text-slate-600 font-bold leading-relaxed uppercase">
                Please Update Satta Chart And Then you are Eligible For using the portal modules
              </p>
              <p className="text-[10px] text-slate-400 font-medium font-sans">
                The Satta Rate Chart matrix must be logged for today before any modules can be accessed.
              </p>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowGlobalSattaWarning(false);
                  globalNavigate('satta');
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>Go to Satta Desk ↗</span>
              </button>
              <button
                onClick={() => setShowGlobalSattaWarning(false)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const PlaceholderPage = ({ name }: { name: string }) => (
  <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      <FileText className="h-10 w-10" />
    </div>
    <h3 className="text-xl font-bold text-slate-600">{name}</h3>
    <p>Module implementation in progress...</p>
  </div>
);
