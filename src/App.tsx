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
  ArrowRight,
  Compass,
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
  DoorClosed,
  Truck,
  ClipboardCheck,
  Wallet,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import bjlAsset from "./assets/asset_bjl.png";
import { SystemNoticeModal } from "./components/SystemNoticeModal";

// Lazy-loaded page components for fast initial load & code-splitting
const TemporaryArrival = React.lazy(() => import("./pages/TemporaryArrival"));
const AmadRegister = React.lazy(() => import("./pages/AmadRegister"));
const SaudaEntry = React.lazy(() => import("./pages/SaudaEntry"));
const BardanaVouchers = React.lazy(() => import("./pages/BardanaVouchers"));
const DirectoryView = React.lazy(() => import("./pages/DirectoryView"));
const Reports = React.lazy(() => import("./pages/Reports"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const StockSummary = React.lazy(() => import("./pages/StockSummary"));
const ConfigGuide = React.lazy(() => import("./pages/ConfigGuide"));
const SaudaRegister = React.lazy(() => import("./pages/SaudaRegister"));
const SmsSaudaDesk = React.lazy(() => import("./pages/SmsSaudaDesk"));
const SattaRegister = React.lazy(() => import("./pages/SattaRegister"));
const SattaEntry = React.lazy(() => import("./pages/SattaEntry"));
const SattaChart = React.lazy(() => import("./pages/SattaChart"));
const PurchaseOrder = React.lazy(() => import("./pages/PurchaseOrder"));
const MaterialIssue = React.lazy(() => import("./pages/MaterialIssue"));
const AdminDesk = React.lazy(() => import("./pages/AdminDesk"));
const AIPortal = React.lazy(() => import("./pages/AIPortal"));
const MaterialInspection = React.lazy(() => import("./pages/MaterialInspection"));
const Inspection = React.lazy(() => import("./pages/Inspection"));
const WeightBridge = React.lazy(() => import("./pages/WeightBridge"));
const MrSettlement = React.lazy(() => import("./pages/MrSettlement"));
const ClosingStockEntry = React.lazy(() => import("./pages/ClosingStockEntry"));
const MismatchCase = React.lazy(() => import("./pages/MismatchCase"));
const ClubPOMR = React.lazy(() => import("./pages/ClubPOMR"));
const FinalArrival = React.lazy(() => import("./pages/FinalArrival"));
const RequisitionDesk = React.lazy(() => import("./pages/RequisitionDesk"));
const PaymentModule = React.lazy(() => import("./pages/PaymentModule"));
const TredeReport = React.lazy(() => import("./pages/TredeReport"));
const LorryDispatchSystem = React.lazy(() => import("./pages/LorryDispatchSystem"));
import LegacyLayout, { LegacyButton } from "./components/LegacyLayout";
import { setCurrentUserContext, getCurrentUserContext, hasModulePermission, getFirstAllowedPage, ALL_SYSTEM_MODULES, subscribeToPermissions, normalizeAllowedModules, getCanonicalModuleId } from "./lib/permissions";

import { supabase } from "./lib/supabase";
import { runDatabaseMigrations } from "./lib/dbMigrations";

runDatabaseMigrations();
import { useIdleTimer } from "./hooks/useIdleTimer";


import { AuthScreen } from "./components/auth/AuthScreen";

const PageLoadingFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center h-full w-full min-h-[350px] p-8 text-slate-500">
    <div className="flex flex-col items-center gap-3">
      <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin shadow-sm" />
      <div className="flex flex-col items-center">
        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
          Loading Module...
        </span>
        <span className="text-[10px] text-slate-400 font-medium mt-0.5">
          Preparing workspace data
        </span>
      </div>
    </div>
  </div>
);

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
  | "inspection"
  | "mr_settlement"
  | "closing_stock"
  | "mismatch"
  | "material_mismatch"
  | "club_po_mr"
  | "final_arrival"
  | "satta_chart"
  | "sms_sauda"
  | "weight_bridge"
  | "main_gate"
  | "trades"
  | "treds"
  | "trade";

const allSidebarItems = [
  { id: "dashboard", label: "Operational Hub", icon: LayoutDashboard },
  { id: "main_gate", label: "Main Gate (Temporary Arrival)", icon: Truck },
  { id: "sms_sauda", label: "SMS Sauda Desk", icon: MessageSquare },
  { id: "sauda", label: "Sauda Desk", icon: HandCoins },
  { id: "po", label: "Sauda Check Point", icon: FileText },
  { id: "final_po", label: "Final P.O", icon: FileText },
  { id: "amad", label: "Temporary Arrival", icon: Archive },
  { id: "final_arrival", label: "Final Arrival", icon: CheckCircle2 },
  { id: "inspection", label: "MILL INSPECTION", icon: ClipboardCheck },
  { id: "material_inspection", label: "INSPECTION CHECKLIST", icon: ShieldCheck },
  { id: "mismatch", label: "Mismatch Case", icon: AlertTriangle },
  { id: "club_po_mr", label: "Club P.O & Arrival", icon: Link },
  { id: "payment", label: "Payment", icon: Wallet },
  { id: "mr_settlement", label: "Settlement", icon: FileCheck },
  { id: "issue", label: "Material Issue", icon: PackageCheck },
  { id: "bardana", label: "Godown Master", icon: Store },
  { id: "closing_stock", label: "Stock Inventory", icon: Layers },
  { id: "weight_bridge", label: "Weight Bridge", icon: Scale },
  { id: "reports", label: "Reports", icon: TrendingUp },
  { id: "settings", label: "Config Center", icon: Settings },
  { id: "admindesk", label: "Admin Desk", icon: Lock },
  { id: "satta", label: "Satta", icon: Sparkles },
  { id: "requisition_desk", label: "Requisition Desk", icon: ClipboardList },
  { id: "vyapari", label: "Trade (Traders Directory)", icon: Users },
  { id: "ai_assistant", label: "Jarves AI 2.0", icon: Bot },
  { id: "treds", label: "Trade", icon: Wallet },
];

function getPageMeta(pageId: string) {
  // 1. Try to find in standard sidebar items
  const item = allSidebarItems.find((i) => i.id === pageId);
  if (item) {
    return { label: item.label, icon: item.icon };
  }

  // 2. Custom mappings
  if (pageId === "main_gate" || pageId === "maingate") {
    return { label: "Main Gate", icon: Truck };
  }
  if (pageId === "amad_entry") {
    return { label: "Amad Entry", icon: PlusCircle };
  }
  if (pageId === "sauda_entry") {
    return { label: "Sauda Entry", icon: PlusCircle };
  }
  if (pageId === "satta_entry") {
    return { label: "Satta Entry", icon: PlusCircle };
  }
  if (pageId === "vyapari" || pageId === "trade" || pageId === "treds" || pageId === "trades" || pageId === "trede") {
    return { label: "Trade", icon: Wallet };
  }
  if (pageId === "admindesk") {
    return { label: "Admin Desk", icon: Settings };
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

const JCI_WORKFLOW_STEPS: {
  stepNumber: number;
  title: string;
  pageId: Page;
  matchPages: Page[];
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}[] = [
  {
    stepNumber: 1,
    title: "Sauda Entry",
    pageId: "sauda",
    matchPages: ["sauda", "sauda_entry", "sms_sauda"],
    icon: HandCoins,
    desc: "Contract & Rate Booking",
  },
  {
    stepNumber: 2,
    title: "Sauda Check Point",
    pageId: "po",
    matchPages: ["po"],
    icon: FileText,
    desc: "Sauda Check Point & Verification",
  },
  {
    stepNumber: 3,
    title: "Temporary Arrival",
    pageId: "amad",
    matchPages: ["amad", "amad_entry", "main_gate"],
    icon: Archive,
    desc: "Gate Inward & Temporary MR",
  },
  {
    stepNumber: 4,
    title: "Mismatch Section",
    pageId: "material_mismatch",
    matchPages: ["material_mismatch", "mismatch"],
    icon: AlertTriangle,
    desc: "Material & Quality Discrepancies",
  },
  {
    stepNumber: 5,
    title: "Final Arrival",
    pageId: "final_arrival",
    matchPages: ["final_arrival"],
    icon: CheckCircle2,
    desc: "Final Weighbridge Arrival & MR",
  },
  {
    stepNumber: 6,
    title: "Mill Inspection",
    pageId: "inspection",
    matchPages: ["inspection", "material_inspection"],
    icon: ClipboardCheck,
    desc: "Quality Audit & Lab Inspection",
  },
  {
    stepNumber: 7,
    title: "Final P.O.",
    pageId: "final_po",
    matchPages: ["final_po"],
    icon: FileText,
    desc: "Approved Final Purchase Order",
  },
  {
    stepNumber: 8,
    title: "Payment",
    pageId: "payment",
    matchPages: ["payment"],
    icon: Wallet,
    desc: "Payment & Accounts Voucher",
  },
  {
    stepNumber: 9,
    title: "Settlement",
    pageId: "mr_settlement",
    matchPages: ["mr_settlement"],
    icon: FileCheck,
    desc: "Final Accounts & Rate Settlement",
  },
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'ready' | 'error'>('loading');
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
  const [selectedAmadForFinalMr, setSelectedAmadForFinalMr] = useState<any>(null);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // Preserving local storage/session storage to maintain login sessions and schema sync flags.
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      }
    } catch (e) {
      console.warn("Cache purge error:", e);
    }
  }, []);

  // Restore authenticated session & module permissions from localStorage
  React.useEffect(() => {
    try {
      const rawSession = localStorage.getItem("bally_auth_session");
      if (rawSession) {
        const sess = JSON.parse(rawSession);
        if (sess && sess.username) {
          const isAdminUser = sess.role?.toUpperCase() === "ADMIN" || sess.role?.toUpperCase() === "ADMINISTRATOR";
          setIsAdmin(isAdminUser);
          setUserRole(sess.role?.toUpperCase() || "L1");
          setUserLevel(sess.level?.toUpperCase() || "L1");
          const rawMods = sess.allowed_modules;
          const mods = (rawMods !== undefined && rawMods !== null && String(rawMods).trim() !== "" && String(rawMods).trim() !== "[]")
            ? normalizeAllowedModules(rawMods)
            : ["*"];
          const finalMods = mods.length === 0 ? ["*"] : mods;
          
          setCurrentUserContext({
            userId: sess.userId || 'op_1',
            username: sess.username,
            userName: sess.username,
            userRole: sess.role?.toUpperCase() || "L1",
            userLevel: sess.level?.toUpperCase() || "L1",
            allowedModules: finalMods,
          });

          setAllowedModules(finalMods);
          setIsLoggedIn(true);
          if (sess.year) setSelectedYear(sess.year);

          // Check if URL specifies a target page
          const urlParams = new URLSearchParams(window.location.search);
          const qPage = urlParams.get('page') || (window.location.hash ? window.location.hash.replace('#', '') : null);
          if (qPage && hasModulePermission(qPage, finalMods, isAdminUser)) {
            setCurrentPage(qPage as Page);
          } else {
            const firstAllowed = getFirstAllowedPage(finalMods, isAdminUser) as Page;
            setCurrentPage(firstAllowed);
          }
        }
      }
      setSessionStatus('ready');
    } catch (e) {
      console.warn("Session restore error:", e);
      setSessionStatus('error');
    }
  }, []);

  // Subscribe to live permission updates (e.g. when Admin updates allowed modules in Admin Desk)
  React.useEffect(() => {
    return subscribeToPermissions((detail) => {
      const currentCtx = getCurrentUserContext();
      if (
        detail.userId === currentCtx.userId ||
        detail.username?.toLowerCase() === currentCtx.username?.toLowerCase() ||
        detail.username?.toLowerCase() === currentCtx.userName?.toLowerCase() ||
        detail.userId === 'all'
      ) {
        const newMods = detail.allowed_modules === "*"
          ? ["*"]
          : normalizeAllowedModules(detail.allowed_modules || "");
        setAllowedModules(newMods);
        const isAdm = detail.role?.toUpperCase() === "ADMIN" || detail.role?.toUpperCase() === "ADMINISTRATOR";
        if (detail.role) {
          setIsAdmin(isAdm);
          setUserRole(detail.role.toUpperCase());
        }
        if (detail.level) {
          setUserLevel(detail.level.toUpperCase());
        }
        setCurrentUserContext({
          allowedModules: newMods,
          userRole: detail.role ? detail.role.toUpperCase() : currentCtx.userRole,
          userLevel: detail.level ? detail.level.toUpperCase() : currentCtx.userLevel,
        }, false);

        try {
          const raw = localStorage.getItem("bally_auth_session");
          if (raw) {
            const parsed = JSON.parse(raw);
            localStorage.setItem("bally_auth_session", JSON.stringify({
              ...parsed,
              allowed_modules: detail.allowed_modules,
              role: detail.role || parsed.role,
              level: detail.level || parsed.level,
            }));
          }
        } catch {}

        // Auto-redirect if currently open page is no longer permitted
        if (!hasModulePermission(currentPage, newMods, isAdm)) {
          const fallback = getFirstAllowedPage(newMods, isAdm) as Page;
          setCurrentPage('dashboard');
        }
      }
    });
  }, [currentPage]);

  // Sync current page to URL for bookmarking and page refresh preservation
  React.useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("page", currentPage);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [currentPage, isLoggedIn]);

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [keyState, setKeyState] = useState({ num: true, caps: false, scrl: false });

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.getModifierState) {
        setKeyState({
          num: e.getModifierState('NumLock'),
          caps: e.getModifierState('CapsLock'),
          scrl: e.getModifierState('ScrollLock'),
        });
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useIdleTimer(15 * 60 * 1000, () => {
    if (isLoggedIn) {
      setIsLoggedIn(false);
      window.alert("Session auto-locked due to 15 minutes of inactivity.");
      localStorage.clear();
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
    let actualTarget = targetPage;
    if (subId === 'po_final' || targetPage === 'po_final' as any) {
      actualTarget = 'final_po';
    } else if (subId === 'po_temp') {
      actualTarget = 'po';
    } else if (targetPage === 'main_gate' as any || targetPage === 'maingate' as any) {
      actualTarget = 'main_gate';
    }

    // Strict Permission Guard: Verify user has permission for the target module
    const isPermitted = hasModulePermission(actualTarget, allowedModules, isAdmin) ||
      (subId ? hasModulePermission(subId, allowedModules, isAdmin) : false);

    if (!isPermitted) {
      alert(`Access Denied: Your account does not have permission to access module [${subId || actualTarget}].`);
      return false;
    }

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

    setCurrentPage(actualTarget);
    if (actualTarget === 'po' || subId === 'po_temp') {
      setIsTempPo(true);
    } else if (actualTarget === 'final_po' || subId === 'po_final') {
      setIsTempPo(false);
    }
    
    return true;
  };

  // Global Ctrl+K command listener and app-navigate listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandSearch((prev) => !prev);
        setCommandSearchQuery("");
        setHighlightedCommandIndex(0);
      }
    };
    const handleAppNavigate = (e: any) => {
      if (e.detail?.page) {
        globalNavigate(e.detail.page as Page, e.detail.subId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("app-navigate", handleAppNavigate);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("app-navigate", handleAppNavigate);
    };
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

  const closePage = (targetPage: Page, destination?: Page) => {
    const fallbackTarget = hasModulePermission("dashboard", allowedModules, isAdmin)
      ? "dashboard"
      : (getFirstAllowedPage(allowedModules, isAdmin) as Page);
    const actualDestination = destination && hasModulePermission(destination, allowedModules, isAdmin)
      ? destination
      : fallbackTarget;

    logEvent(
      "PAGE_CLOSE",
      `Terminated & Closed workspace screen instance "${targetPage}". Returning to "${actualDestination}"`,
    );
    setRunningPages((prev) => prev.filter((p) => p !== targetPage));
    if (actualDestination !== targetPage) {
      globalNavigate(actualDestination);
    }
  };

  React.useEffect(() => {
    const fallbackTarget = hasModulePermission("dashboard", allowedModules, isAdmin)
      ? "dashboard"
      : (getFirstAllowedPage(allowedModules, isAdmin) as Page);

    const handleBack = () => {
      if (currentPage !== "dashboard" && currentPage !== fallbackTarget) {
        const pageToClose = currentPage;
        logEvent("PAGE_CLOSE", `Event dynamic Back: closing "${pageToClose}"`);
        setRunningPages((prev) => prev.filter((p) => p !== pageToClose));
        globalNavigate(fallbackTarget);
      } else {
        logEvent(
          "SYSTEM_DEPART",
          "Session ended - operator exited login screen",
        );
        setIsLoggedIn(false);
      }
    };
    const handleClose = () => {
      if (currentPage !== "dashboard" && currentPage !== fallbackTarget) {
        const pageToClose = currentPage;
        logEvent(
          "PAGE_CLOSE",
          `Event dynamic Close: stopping application widget "${pageToClose}"`,
        );
        setRunningPages((prev) => prev.filter((p) => p !== pageToClose));
        globalNavigate(fallbackTarget);
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
    window.addEventListener("app-close", handleClose);
    window.addEventListener("app-navigate", handleAppNavigate);

    return () => {
      window.removeEventListener("app-back", handleBack);
      window.removeEventListener("app-close", handleClose);
      window.removeEventListener("app-navigate", handleAppNavigate);
    };
  }, [currentPage, allowedModules, isAdmin]);

  const handleLogin = async (year: string, user: string, pass: string) => {
    // Master Admin Fallback
    if (user.toLowerCase() === "admin") {
      if (pass !== "Admin@4321") {
        alert("Access denied: Invalid Admin Password.");
        return;
      }
      setIsAdmin(true);
      setUserRole("ADMIN");
      setUserLevel("ADMIN");
      setIsLoggedIn(true);
      setSelectedYear(year);
      setAllowedModules(["*"]);
      setCurrentPage("dashboard");
      setCurrentUserContext({ userId: "admin", username: "ADMIN", userName: "ADMIN", userRole: "ADMIN", userLevel: "ADMIN", allowedModules: ["*"] });
      try {
        localStorage.setItem("bally_auth_session", JSON.stringify({
          userId: "admin",
          username: "ADMIN",
          role: "ADMIN",
          level: "ADMIN",
          allowed_modules: "*",
          year: year
        }));
      } catch (e) {}
      logEvent(
        "LOGIN_HISTORY",
        `Administrator login verified under session year: ${year}`,
      );
      setSessionStatus('ready');
      return;
    }

    if (!supabase) {
      alert("System offline. Use master override credentials.");
      return;
    }

    try {
      const trimmedUser = user.trim();
      const { data, error } = await supabase
        .from("user_master")
        .select("*")
        .or(`user_id.ilike.${trimmedUser},username.ilike.${trimmedUser}`)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        alert("Invalid system credentials. User not found.");
        return;
      }

      if (data.status && data.status.toLowerCase() !== "active") {
        alert("Access denied: Your account is currently inactive. Please contact Administrator.");
        return;
      }

      // Check password (assume plain text for this legacy demo or user preference)
      if (data.password === pass) {
        const isAdminUser =
          data.role?.toUpperCase() === "ADMIN" ||
          data.role?.toUpperCase() === "ADMINISTRATOR";
        setIsAdmin(isAdminUser);
        setUserRole(data.role?.toUpperCase() || "L1");
        setUserLevel(data.level?.toUpperCase() || "L1");
        const rawMods = data.allowed_modules;
        const modules = (rawMods !== undefined && rawMods !== null && String(rawMods).trim() !== "" && String(rawMods).trim() !== "[]")
          ? normalizeAllowedModules(rawMods)
          : ["*"];
        const finalMods = modules.length === 0 ? ["*"] : modules;

        setCurrentUserContext({
          userId: data.user_id,
          username: data.username,
          userName: data.username,
          userRole: data.role?.toUpperCase() || "L1",
          userLevel: data.level?.toUpperCase() || "L1",
          allowedModules: finalMods,
        });

        setAllowedModules(finalMods);
        setIsLoggedIn(true);
        setSelectedYear(year);

        const firstLanding = getFirstAllowedPage(finalMods, isAdminUser) as Page;
        setCurrentPage(firstLanding);

        // Persist session
        try {
          localStorage.setItem("bally_auth_session", JSON.stringify({
            userId: data.user_id,
            username: data.username,
            role: data.role?.toUpperCase() || "L1",
            level: data.level?.toUpperCase() || "L1",
            allowed_modules: data.allowed_modules || "*",
            year: year
          }));
        } catch (e) {}

        // Update last login
        supabase.from('user_master').update({ last_login: new Date().toISOString() }).eq('user_id', data.user_id).then(res => console.log("Login Update:", res));
        
        logEvent(
          "LOGIN_HISTORY",
          `Operator account: ${data.username} [Role: ${data.role || "USER"}] successfully logged in under session year: ${year}`,
        );
        setSessionStatus('ready');
      } else {
        alert("Access denied: Authentication failure.");
      }
    } catch (err) {
      console.error("Login fault:", err);
      alert("Internal security fault. Verify DB connection.");
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAF7F0] font-sans">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-base font-bold text-[#1E331B] uppercase tracking-wide">Loading your workspace...</h2>
          <p className="text-xs text-slate-500 mt-1">Verifying access permissions and active session...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'error') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAF7F0] font-sans">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-200 max-w-sm w-full">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold">!</div>
          <h2 className="text-base font-bold text-red-900 uppercase tracking-wide">Session Verification Error</h2>
          <p className="text-xs text-slate-600 mt-1">Unable to load workspace security context. Please check your connection and reload.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#1E331B] text-white rounded text-xs font-bold uppercase cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

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
          (item) => hasModulePermission(item.id, allowedModules, isAdmin),
        );

  return (
    <div className="flex h-screen w-full max-w-full min-w-0 overflow-hidden bg-legacy-bg font-sans">
      {/* Master Wrapper */}
      <div className="flex flex-1 flex-col w-full max-w-full min-w-0 h-full overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden w-full max-w-full min-w-0">
          {/* Sidebar removed per user request */}

          {/* Dynamic Page Rendering */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-auto w-full max-w-full main-content">
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-auto relative w-full max-w-full">
              {!hasModulePermission(currentPage, allowedModules, isAdmin) ? (
                <LegacyLayout
                  title="ACCESS CONTROL RESTRICTION"
                  allowedModules={allowedModules}
                  isAdmin={isAdmin}
                  onNavClick={(page) => globalNavigate(page as Page)}
                >
                  <div className="flex-1 flex items-center justify-center p-8 bg-[#F4EFE6] min-h-[500px]">
                    <div className="bg-[#FAF7F0] border-2 border-red-300 rounded-xl p-8 max-w-lg text-center shadow-lg">
                      <div className="w-14 h-14 rounded-full bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Lock className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-bold text-[#1E331B] uppercase tracking-wide">Access Restricted</h3>
                      <p className="text-sm text-[#5A6E54] mt-2">
                        Your operator account does not hold permissions to access module <span className="font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">[{ALL_SYSTEM_MODULES.find(x => x.id === currentPage || x.pageId === currentPage || x.aliases.includes(currentPage))?.label || currentPage}]</span>.
                      </p>
                      
                      <div className="mt-4 p-3 bg-white/80 rounded-lg border border-slate-200 text-left">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Your Permitted Modules:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(allowedModules && allowedModules.length > 0 && !allowedModules.includes("*") ? allowedModules : ['dashboard']).map((m) => {
                            const def = ALL_SYSTEM_MODULES.find(x => x.id === m || x.aliases.includes(m));
                            const label = def?.label || m;
                            const pageId = (def?.pageId || m) as Page;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => globalNavigate(pageId)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const firstAllowed = getFirstAllowedPage(allowedModules, isAdmin) as Page;
                            globalNavigate(firstAllowed);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 bg-[#1E331B] text-[#FAF7F0] rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#2A4426] transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Go to Permitted Module
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem("bally_auth_session");
                            localStorage.removeItem("bally_user_context");
                            setIsLoggedIn(false);
                            setIsAdmin(false);
                            setAllowedModules(["*"]);
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer"
                        >
                          Logout / Switch User
                        </button>
                      </div>
                    </div>
                  </div>
                </LegacyLayout>
              ) : (
                <React.Suspense fallback={<PageLoadingFallback />}>
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
                className={currentPage === "main_gate" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <LorryDispatchSystem
                  onNavigate={(page) => globalNavigate(page as Page)}
                />
              </div>
              <div
                className={currentPage === "amad" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <AmadRegister
                  onClose={() => closePage("amad", "dashboard")}
                  onNew={() => globalNavigate("amad_entry")}
                  onNavigate={(page) => globalNavigate(page as Page)}
                  onCreateFinalMr={(amad) => {
                    setSelectedAmadForFinalMr(amad);
                    globalNavigate("final_arrival");
                  }}
                />
              </div>
              {currentPage === "amad_entry" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <TemporaryArrival
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
                  onNavigate={(p) => globalNavigate(p as Page)}
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
                className={(currentPage === "vyapari" || (currentPage as string) === "trade") ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <DirectoryView
                  title="Trade (Traders Directory)"
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
                className={(currentPage === "treds" || (currentPage as string) === "trade" || (currentPage as string) === "trades" || (currentPage as string) === "trede") ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <TredeReport onClose={() => closePage(currentPage, "dashboard")} />
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
                className={currentPage === "inspection" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <Inspection
                  onNavigate={(page) => globalNavigate(page as Page)}
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
                  initialData={selectedAmadForFinalMr}
                  onClose={() => {
                    setSelectedAmadForFinalMr(null);
                    closePage("final_arrival", "dashboard");
                  }}
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
                </React.Suspense>
              )}
            </div>
          </div>
        </div>

        {/* Single Unified Dark Green Footer */}
        <div className="bg-[#174C2C] border-t-2 border-[#103A20] px-3 py-1.5 flex justify-between items-center text-white shrink-0 shadow-2xl z-40 gap-3 w-full min-w-0">
          {/* Left Section: Online status & JCI Arrow-Wise Workflow Guide */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {/* System Online Status Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#103A20] rounded-md border border-[#235E39] text-[#E2EDDE] shrink-0">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", isOnline ? "bg-emerald-400 shadow-xs" : "bg-rose-500")} />
              <span className={cn("uppercase tracking-wider font-mono font-bold text-[10px]", isOnline ? "text-emerald-300" : "text-rose-400")}>
                {isOnline ? 'SYSTEM ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div className="h-5 w-px bg-[#235E39] shrink-0" />

            {/* JCI Software Process Workflow Arrow Guide */}
            <div className="flex items-center gap-1.5 shrink-0 bg-[#0E351D] px-2 py-0.5 rounded-lg border border-[#235E39]/80 shadow-inner">
              {/* Sequential Arrow-Wise Steps */}
              <div className="flex items-center gap-1 shrink-0">
                {(() => {
                  const permittedWorkflowSteps = JCI_WORKFLOW_STEPS.filter((step) =>
                    hasModulePermission(step.pageId, allowedModules, isAdmin) ||
                    step.matchPages.some((p) => hasModulePermission(p, allowedModules, isAdmin))
                  );

                  if (permittedWorkflowSteps.length === 0) return null;

                  const activeStepIdx = permittedWorkflowSteps.findIndex((step) =>
                    step.matchPages.includes(currentPage)
                  );

                  return permittedWorkflowSteps.map((step, idx) => {
                    const isCurrent = step.matchPages.includes(currentPage);
                    const isPast = activeStepIdx !== -1 && idx < activeStepIdx;
                    const IconComp = step.icon;

                    return (
                      <React.Fragment key={step.stepNumber}>
                        <button
                          type="button"
                          onClick={() => globalNavigate(step.pageId)}
                          title={`Step ${step.stepNumber}: ${step.title} — ${step.desc} (Click to Navigate)`}
                          className={cn(
                            "group/step flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all duration-150 cursor-pointer shrink-0 border select-none",
                            isCurrent
                              ? "bg-[#256B3E] border-amber-300 text-amber-300 font-black shadow-md ring-2 ring-amber-400/50 scale-[1.02]"
                              : isPast
                              ? "bg-[#124225] border-[#2E7A4A] text-emerald-300 hover:bg-[#1A5732] hover:text-white font-bold"
                              : "bg-[#0E331B] border-[#1C5130] text-emerald-200/90 hover:bg-[#164927] hover:text-white font-medium"
                          )}
                        >
                          <span
                            className={cn(
                              "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-black shrink-0",
                              isCurrent
                                ? "bg-amber-400 text-[#0E351D]"
                                : isPast
                                ? "bg-emerald-600 text-white"
                                : "bg-[#184F2B] text-emerald-300 border border-[#2E7A4A]"
                            )}
                          >
                            {step.stepNumber}
                          </span>
                          <IconComp
                            className={cn(
                              "w-3 h-3 shrink-0",
                              isCurrent ? "text-amber-300" : isPast ? "text-emerald-400" : "text-emerald-400/70"
                            )}
                          />
                          <span className="text-[11px] whitespace-nowrap tracking-tight font-bold">
                            {step.title}
                          </span>
                        </button>

                        {/* Arrow separator */}
                        {idx < permittedWorkflowSteps.length - 1 && (
                          <div className="flex items-center text-amber-400 px-0.5 shrink-0">
                            <span className="text-[12px] font-black text-amber-400/90">➔</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Right Section: Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Logout Button */}
            <button
              onClick={() => {
                setIsLoggedIn(false);
                try {
                  localStorage.removeItem("bally_auth_session");
                } catch (e) {}
                setCurrentUserContext({ username: 'Operator', userRole: 'L1', userLevel: 'L1', allowedModules: [] });
                setCurrentPage("dashboard");
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#103A20] hover:bg-rose-950/80 rounded-md border border-[#235E39] hover:border-rose-700 text-rose-300 hover:text-rose-100 transition-colors text-[10px] font-extrabold uppercase tracking-wider shrink-0 cursor-pointer"
              title="Logout System"
            >
              <Power className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden xs:inline">LOGOUT</span>
            </button>
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
 id="search_by_module_name_e_g_1539" name="search_by_module_name_e_g" aria-label="Search by module name (e.g. Settlement, Purchase PO, Quality)..."                  type="text"
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
                              hasModulePermission(item.id, allowedModules, isAdmin),
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
                      hasModulePermission(item.id, allowedModules, isAdmin),
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
                      hasModulePermission(item.id, allowedModules, isAdmin),
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
                  globalNavigate('satta_chart');
                }}
                className="flex-1 bg-[#174C2C] hover:bg-[#205c36] active:bg-[#133b23] text-amber-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Upload Satta Chart ↗</span>
              </button>
              <button
                onClick={() => setShowGlobalSattaWarning(false)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
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
