import React from 'react';
import { 
  X, 
  Minus, 
  Square,
  Clock,
  ArrowLeft,
  Bell,
  LayoutDashboard,
  Factory,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  ShieldCheck,
  BarChart3,
  User,
  ChevronDown,
  Sparkles,
  MessageSquare,
  HandCoins,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Link,
  FileCheck,
  Wallet,
  PackageCheck,
  Layers,
  ClipboardList,
  Scale,
  Archive,
  Lock,
  DoorClosed,
  Truck,
  Menu,
  ClipboardCheck,
  TrendingUp,
  Warehouse,
  Users,
  Settings,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useHeartbeat } from '../hooks/useHeartbeat';
import NotificationCenter from './NotificationCenter';
import { UniversalAuditLogModal } from './UniversalAuditLogModal';
import { 
  getCurrentUserContext, 
  hasModulePermission, 
  filterMenuByPermissions, 
  subscribeToPermissions, 
  isUserAdmin,
  getFirstAllowedPage
} from '../lib/permissions';
import { supabase } from '../lib/supabase';

interface DisputeSummaryData {
  materialMismatchCount: number;
  sattaDisputeCount: number;
  recentCases: any[];
}

let globalDisputeCache: DisputeSummaryData = {
  materialMismatchCount: 0,
  sattaDisputeCount: 0,
  recentCases: []
};

let disputePollTimer: ReturnType<typeof setInterval> | null = null;
let isDisputePolling = false;
let lastDisputePollTime = 0;
const disputeSubscribers = new Set<(data: DisputeSummaryData) => void>();

async function fetchGlobalDisputes() {
  if (!supabase) return;
  const now = Date.now();
  if (isDisputePolling || (now - lastDisputePollTime < 25000 && lastDisputePollTime > 0)) {
    return;
  }
  isDisputePolling = true;
  lastDisputePollTime = now;

  try {
    const [mmRes, smRes] = await Promise.all([
      supabase.from('material_mismatch').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('satta_mismatch').select('*').order('created_at', { ascending: false }).limit(10)
    ]);

    const mmList = mmRes.data || [];
    const smList = smRes.data || [];
    
    const pendingMM = mmList.filter((m: any) => (m.status || 'pending').toLowerCase() !== 'approved' && (m.status || 'pending').toLowerCase() !== 'cleared');
    const pendingSM = smList.filter((s: any) => (s.status || 'dispute').toLowerCase() !== 'approved' && (s.status || 'dispute').toLowerCase() !== 'cleared');

    const combined = [
      ...pendingMM.map((m: any) => ({ ...m, caseType: 'Material Mismatch', id: m.mismatch_id || m.id, date: m.created_at || new Date().toISOString() })),
      ...pendingSM.map((s: any) => ({ ...s, caseType: 'Satta Dispute', id: s.mismatch_id || s.id, date: s.created_at || new Date().toISOString() }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    globalDisputeCache = {
      materialMismatchCount: pendingMM.length,
      sattaDisputeCount: pendingSM.length,
      recentCases: combined
    };

    disputeSubscribers.forEach(cb => cb(globalDisputeCache));
  } catch (err) {
    console.warn("Dispute fetch warn:", err);
  } finally {
    isDisputePolling = false;
  }
}

function subscribeToDisputes(callback: (data: DisputeSummaryData) => void) {
  disputeSubscribers.add(callback);
  callback(globalDisputeCache);

  if (!disputePollTimer && typeof window !== 'undefined') {
    fetchGlobalDisputes();
    disputePollTimer = setInterval(fetchGlobalDisputes, 45000);
  }

  return () => {
    disputeSubscribers.delete(callback);
  };
}

interface LegacyLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onBack?: () => void;
  activeNavTab?: string;
  onNavClick?: (pageId: string) => void;
  allowedModules?: string[];
  isAdmin?: boolean;
}

export default function LegacyLayout({ 
  title, 
  subtitle, 
  children, 
  onClose, 
  onMinimize, 
  onMaximize, 
  onBack,
  activeNavTab = "dashboard",
  onNavClick,
  allowedModules: propAllowedModules,
  isAdmin: propIsAdmin
}: LegacyLayoutProps) {
  const isOnline = useHeartbeat();
  const [currentTime, setCurrentTime] = React.useState(() => new Date());
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(3);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [activeMenuDropdown, setActiveMenuDropdown] = React.useState<string | null>(null);

  const [userContext, setUserContext] = React.useState(() => getCurrentUserContext());

  React.useEffect(() => {
    const unsub = subscribeToPermissions((updated) => {
      setUserContext({ ...updated });
    });

    const handlePermUpdated = (e: any) => {
      const latest = getCurrentUserContext();
      setUserContext({ ...latest });
    };

    window.addEventListener('bally-permissions-updated', handlePermUpdated);
    return () => {
      unsub();
      window.removeEventListener('bally-permissions-updated', handlePermUpdated);
    };
  }, []);

  const effectiveAllowedModules = propAllowedModules !== undefined
    ? propAllowedModules
    : (userContext.allowedModules || []);
  const effectiveIsAdmin = propIsAdmin !== undefined
    ? propIsAdmin
    : isUserAdmin(userContext);

  const currentUser = userContext.username || userContext.userName || "Operator";

  const [disputeSummary, setDisputeSummary] = React.useState<{
    materialMismatchCount: number;
    sattaDisputeCount: number;
    recentCases: any[];
  }>(() => globalDisputeCache);
  const [isDisputeTrayOpen, setIsDisputeTrayOpen] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = subscribeToDisputes((summary) => {
      setDisputeSummary(summary);
    });
    return unsubscribe;
  }, []);

  
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-dropdown-container')) {
        setActiveMenuDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const [keyState, setKeyState] = React.useState({
    num: true,
    caps: false,
    scrl: false
  });

  React.useEffect(() => {
    const handleKeyEvent = (e: KeyboardEvent | MouseEvent) => {
      const num = e.getModifierState('NumLock');
      const caps = e.getModifierState('CapsLock');
      const scrl = e.getModifierState('ScrollLock');
      setKeyState(prev => {
        if (prev.num === num && prev.caps === caps && prev.scrl === scrl) {
          return prev;
        }
        return { num, caps, scrl };
      });
    };

    window.addEventListener('keydown', handleKeyEvent as any);
    window.addEventListener('mousedown', handleKeyEvent as any);
    
    return () => {
      window.removeEventListener('keydown', handleKeyEvent as any);
      window.removeEventListener('mousedown', handleKeyEvent as any);
    };
  }, []);

  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpenAudit = () => setIsAuditLogOpen(true);
    window.addEventListener('open-system-change-logs', handleOpenAudit);
    return () => window.removeEventListener('open-system-change-logs', handleOpenAudit);
  }, []);

  React.useEffect(() => {
    const onFsChange = () => {
      setIsMaximized(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      window.dispatchEvent(new CustomEvent('app-back'));
      if (onClose) {
        onClose();
      }
    }
  };

  const handleMinimizeClick = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      window.dispatchEvent(new CustomEvent('app-minimize'));
    }
  };

  const handleMaximizeClick = () => {
    if (onMaximize) {
      onMaximize();
    } else {
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
            .then(() => setIsMaximized(true))
            .catch(() => {});
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen()
              .then(() => setIsMaximized(false))
              .catch(() => {});
          }
        }
      } catch (err) {
        setIsMaximized(!isMaximized);
      }
    }
  };

  const handleCloseClick = () => {
    if (onClose) {
      onClose();
    } else {
      window.dispatchEvent(new CustomEvent('app-close'));
    }
  };

  const handleNavNavigation = (pageId: string) => {
    setActiveMenuDropdown(null);
    if (onNavClick) {
      onNavClick(pageId);
    } else {
      window.dispatchEvent(new CustomEvent('app-navigate', { detail: { page: pageId } }));
    }
  };

  const navMenuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      pageId: 'dashboard'
    },
    {
      id: 'gate_module',
      label: 'Gate Module',
      icon: DoorClosed,
      subItems: [
        { id: 'main_gate', label: 'Main Gate', icon: Truck, pageId: 'main_gate' },
      ]
    },
    {
      id: 'sauda_po',
      label: 'Sauda To P.O',
      icon: ShoppingCart,
      subItems: [
        { id: 'satta', label: 'Satta', icon: Sparkles, pageId: 'satta' },
        { id: 'sms_sauda', label: 'SMS Sauda Desk', icon: MessageSquare, pageId: 'sms_sauda' },
        { id: 'sauda', label: 'Sauda Desk', icon: HandCoins, pageId: 'sauda' },
        { id: 'po', label: 'Sauda Check Point', icon: FileText, pageId: 'po' },
        { id: 'final_po', label: 'Final P.O', icon: FileText, pageId: 'final_po' },
      ]
    },
    {
      id: 'tmr_mr',
      label: 'Temporary Arrival To Final Arrival',
      icon: ShieldCheck,
      subItems: [
        { id: 'amad', label: 'TEMPORARY ARRIVAL', icon: Clock, pageId: 'amad' },
        { id: 'final_arrival', label: 'FINAL ARRIVAL', icon: CheckCircle2, pageId: 'final_arrival' },
        { id: 'inspection', label: 'MILL INSPECTION', icon: ClipboardCheck, pageId: 'inspection' },
        { id: 'material_inspection', label: 'INSPECTION CHECKLIST', icon: ShieldCheck, pageId: 'material_inspection' },
        { id: 'mismatch', label: 'SATTA MISMATCH', icon: AlertTriangle, pageId: 'mismatch' },
        { id: 'material_mismatch', label: 'MATERIAL MISMATCH', icon: AlertTriangle, pageId: 'material_mismatch' },
      ]
    },
    {
      id: 'club_payment',
      label: 'Club P.O To Payment',
      icon: Wallet,
      subItems: [
        { id: 'club_po_mr', label: 'Club P.O & Arrival', icon: Link, pageId: 'club_po_mr' },
        { id: 'payment', label: 'Payment', icon: Wallet, pageId: 'payment' },
        { id: 'mr_settlement', label: 'Settlement', icon: FileCheck, pageId: 'mr_settlement' },
      ]
    },
    {
      id: 'material_inventory',
      label: 'Material Issue To Inventory',
      icon: Boxes,
      subItems: [
        { id: 'issue', label: 'Material Issue', icon: PackageCheck, pageId: 'issue' },
        { id: 'closing_stock', label: 'Stock Inventory', icon: Layers, pageId: 'closing_stock' },
        { id: 'requisition_desk', label: 'Requisition Desk', icon: ClipboardList, pageId: 'requisition_desk' },
        { id: 'bardana', label: 'Godown Master', icon: Warehouse, pageId: 'bardana' },
        { id: 'weight_bridge', label: 'Weight Bridge', icon: Scale, pageId: 'weight_bridge' },
      ]
    },
    {
      id: 'reports_admin',
      label: 'Reports & Admin',
      icon: BarChart3,
      subItems: [
        { id: 'reports', label: 'Report', icon: BarChart3, pageId: 'reports' },
        { id: 'system_change_logs', label: 'System Change Log', icon: History, pageId: 'system_change_logs' },
        { id: 'treds', label: 'Trade', icon: Wallet, pageId: 'treds' },
        { id: 'admindesk', label: 'Admin Desk', icon: Lock, pageId: 'admindesk' },
        { id: 'ai_assistant', label: 'Jarves AI 2.0', icon: Sparkles, pageId: 'ai_assistant' },
      ]
    }
  ];

  const filteredNavMenuItems = React.useMemo(() => {
    return filterMenuByPermissions(navMenuItems, effectiveAllowedModules, effectiveIsAdmin);
  }, [navMenuItems, effectiveAllowedModules, effectiveIsAdmin]);

  const handleBrandLogoClick = () => {
    const defaultTarget = hasModulePermission('dashboard', effectiveAllowedModules, effectiveIsAdmin)
      ? 'dashboard'
      : getFirstAllowedPage(effectiveAllowedModules, effectiveIsAdmin);
    handleNavNavigation(defaultTarget);
  };

  return (
    <div className="bg-[#F4EFE6] h-full w-full min-w-0 font-sans selection:bg-[#1E331B] selection:text-white flex flex-col">
      {/* Window Wrapper */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 border border-[#C5BA9E] bg-[#FAF7F0] shadow-xl overflow-hidden">
        
        {/* Top Control Bar */}
        <div className="relative bg-[#103A20] border-b border-[#0F351E] px-2 sm:px-3.5 py-1.5 flex items-center justify-between text-white shrink-0 shadow-md z-30 w-full min-w-0 gap-2">
          {/* Left Brand Logo Area */}
          <div 
            onClick={handleBrandLogoClick} 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0 flex-1"
          >
            {/* BJ Monogram Badge */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#174C2C] text-[#D4AF37] font-serif font-black text-xs sm:text-sm flex items-center justify-center shadow-md border-2 border-[#D4AF37] group-hover:scale-105 transition-all shrink-0">
              BJ
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-sm sm:text-2xl font-black text-white tracking-tight leading-none group-hover:text-amber-300 transition-colors truncate">
                Bally Jute Limited
              </h1>
              <p className="text-[8px] sm:text-[9.5px] font-mono text-emerald-200 tracking-[0.15em] sm:tracking-[0.25em] uppercase font-bold mt-0.5 truncate">
                ESTD. 1979 • RAW JUTE MANAGEMENT ERP
              </p>
            </div>
          </div>

          <div className="flex gap-1 sm:gap-1.5 shrink-0 z-10 items-center">
             <button
               type="button"
               onClick={() => setIsAuditLogOpen(true)}
               title="Universal System Audit & Change Log"
               className="h-5 px-2 bg-[#174C2C] hover:bg-[#235E39] text-[#D4AF37] border border-[#D4AF37]/50 rounded flex items-center gap-1 text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
             >
               <History className="h-3 w-3 text-[#D4AF37]" />
               <span className="hidden sm:inline">Change Logs</span>
             </button>
             <button 
               onClick={handleMaximizeClick}
               title="Maximize / Restore"
               className="h-5 w-5 bg-[#174C2C] hover:bg-[#235E39] text-white border border-[#2D7344] rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
             >
               <Square className="h-2.5 w-2.5" />
             </button>
             <button 
               onClick={handleCloseClick}
               title="Close"
               className="h-5 w-5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
             >
               <X className="h-3 w-3" />
             </button>
          </div>
        </div>

        {/* Main Header & Navigation Bar (Same Green Colour As Footer) */}
        <header className="bg-[#174C2C] border-b-2 border-[#103A20] px-2 sm:px-4 py-1.5 flex flex-wrap items-center justify-between shrink-0 shadow-lg relative z-50 gap-2 w-full min-w-0">
          
          {/* Top Navigation Menu Bar with Sub-Menu Dropdowns */}
          <nav className="flex items-center gap-1 flex-wrap py-0.5 min-w-0 flex-1 relative z-50 max-w-full">
            {filteredNavMenuItems.map((menu) => {
              const IconComp = menu.icon;
              const hasSubItems = menu.subItems && menu.subItems.length > 0;
              const isDropdownOpen = activeMenuDropdown === menu.id;

              if (!hasSubItems) {
                const isActive = activeNavTab === menu.pageId;
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => handleNavNavigation(menu.pageId!)}
                    className={cn(
                      "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative cursor-pointer group max-w-full min-w-0",
                      isActive
                        ? "text-white bg-[#0F351E] font-black shadow-md border border-[#235E39]"
                        : "text-white font-bold hover:text-white hover:bg-[#215E38]"
                    )}
                  >
                    <IconComp className={cn(
                      "w-3.5 h-3.5 transition-transform group-hover:scale-110 shrink-0",
                      isActive ? "text-[#D4AF37] stroke-[2.5]" : "text-emerald-200"
                    )} />
                    <span className="text-[11.5px] sm:text-[13px] tracking-tight truncate max-w-[120px] sm:max-w-none text-white font-black">{menu.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#D4AF37] rounded-full" />
                    )}
                  </button>
                );
              }

              return (
                <div 
                  key={menu.id}
                  className="relative nav-dropdown-container max-w-full min-w-0 z-50"
                  onMouseEnter={() => setActiveMenuDropdown(menu.id)}
                  onMouseLeave={() => setActiveMenuDropdown(null)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuDropdown(menu.id);
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer group select-none max-w-full min-w-0",
                      isDropdownOpen
                        ? "text-white bg-[#0F351E] font-black shadow-md border border-[#235E39]"
                        : "text-white font-bold hover:text-white hover:bg-[#215E38]"
                    )}
                  >
                    <IconComp className="w-3.5 h-3.5 text-emerald-200 group-hover:text-amber-300 transition-colors shrink-0" />
                    <span className="text-[11.5px] sm:text-[13px] tracking-tight truncate max-w-[120px] sm:max-w-none text-white font-black">{menu.label}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform text-white font-bold shrink-0", isDropdownOpen && "rotate-180 text-amber-300")} />
                  </button>

                  {/* Sub-menu Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 pt-1 z-[999] min-w-[220px] max-w-[calc(100vw-16px)]">
                      <div className="bg-[#103A20] border-2 border-[#235E39] rounded-xl shadow-2xl py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-3.5 py-1.5 border-b border-[#1E4D2C] mb-1 bg-[#0A2615]">
                          <span className="text-[10.5px] font-mono font-black uppercase tracking-wider text-amber-300">
                            {menu.label} Menu
                          </span>
                        </div>
                        {menu.subItems.map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuDropdown(null);
                                handleNavNavigation(sub.pageId);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#1E4D2C] hover:text-white flex items-center gap-2.5 text-xs font-bold text-white transition-colors cursor-pointer group/item"
                            >
                              <div className="w-6 h-6 rounded-md bg-[#174C2C] border border-[#2D7344] group-hover/item:bg-[#D4AF37] group-hover/item:text-[#103A20] text-emerald-200 flex items-center justify-center transition-colors shrink-0">
                                <SubIcon className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="truncate font-black text-[12px] uppercase tracking-tight text-white">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right Notification & Profile User Menu - Anchored right */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto z-50">
            {/* Realtime Connection Status Indicator Badge */}
            <div 
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-black shadow-xs transition-all",
                isOnline 
                  ? "bg-[#103A20] border-[#2D7344] text-white font-bold" 
                  : "bg-rose-950 border-rose-700 text-rose-300 font-bold"
              )}
              title={isOnline ? "Supabase Realtime Live Data Sync Active" : "Reconnecting to Supabase Live Sync..."}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <span className="hidden xs:inline text-white font-bold">Live</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  <span className="hidden xs:inline text-rose-200 font-bold">Offline</span>
                </>
              )}
            </div>

            {/* Notification Tray for New Material Mismatch or Satta Dispute Cases */}
            {(disputeSummary.materialMismatchCount > 0 || disputeSummary.sattaDisputeCount > 0) && (
              <div className="relative">
                <button
                  onClick={() => setIsDisputeTrayOpen(!isDisputeTrayOpen)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 hover:bg-amber-300 border border-amber-300 text-[#103A20] text-[11px] font-black shadow-md transition-all cursor-pointer animate-pulse"
                  title="New Material Mismatch or Satta Dispute Cases Opened"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#103A20]" />
                  <span className="hidden md:inline font-black">Cases:</span>
                  <span className="bg-[#103A20] text-amber-300 font-black px-1.5 py-0.2 rounded-full text-[10px]">
                    {disputeSummary.materialMismatchCount + disputeSummary.sattaDisputeCount}
                  </span>
                </button>

                {isDisputeTrayOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl py-3 z-[9999] text-xs text-white">
                    <div className="px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="font-black text-amber-200 uppercase tracking-wider text-[11px]">Active Disputed Cases</span>
                      </div>
                      <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded-full font-bold">
                        {disputeSummary.materialMismatchCount + disputeSummary.sattaDisputeCount} New
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                      {disputeSummary.recentCases.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">No active dispute cases.</div>
                      ) : (
                        disputeSummary.recentCases.slice(0, 6).map((c: any, i: number) => {
                          const caseTypeStr = typeof c.caseType === 'object' ? JSON.stringify(c.caseType) : String(c.caseType || '');
                          const mrPoVal = c.mr_no || c.po_no || c.sauda_no;
                          const mrPoStr = typeof mrPoVal === 'object' ? (mrPoVal.mr_no || mrPoVal.po_no || JSON.stringify(mrPoVal)) : String(mrPoVal || 'N/A');
                          const gradeStr = typeof c.grade === 'object' ? '' : (c.grade ? `(${c.grade})` : '');
                          const rawDesc = c.remarks || c.issue_description || c.field;
                          const descStr = typeof rawDesc === 'object' ? (rawDesc.field || rawDesc.message || JSON.stringify(rawDesc)) : String(rawDesc || 'Discrepancy flagged between expected and actual values.');
                          const dateStr = c.date && !isNaN(new Date(c.date).getTime()) ? new Date(c.date).toLocaleDateString() : '';

                          return (
                            <div key={i} className="p-3 hover:bg-slate-800/85 transition-colors flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <span className="font-black text-amber-300 text-[11px] uppercase">{caseTypeStr}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {dateStr}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-200 font-bold truncate">
                                MR / PO: {mrPoStr} {gradeStr}
                              </p>
                              <p className="text-[10px] text-slate-400 line-clamp-1">
                                {descStr}
                              </p>
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => {
                                    setIsDisputeTrayOpen(false);
                                    handleNavNavigation(c.caseType === 'Material Mismatch' ? 'material_mismatch' : 'mismatch');
                                  }}
                                  className="text-[10px] bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold px-2 py-0.5 rounded transition-colors"
                                >
                                  Review Case →
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notification Badge Bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 rounded-full bg-[#103A20] hover:bg-[#215E38] text-white border border-[#2D7344] transition-colors cursor-pointer shadow-xs"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center border border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Admin User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-2 bg-[#103A20] hover:bg-[#215E38] border border-[#2D7344] rounded-full px-2.5 sm:px-3 py-1 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#174C2C] border border-[#2D7344] text-[#D4AF37] flex items-center justify-center text-[10px] sm:text-[11px] font-bold">
                  <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="hidden sm:inline font-bold text-white">{currentUser}</span>
                <ChevronDown className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Profile Menu Dropdown Overlay */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#103A20] border-2 border-[#235E39] rounded-xl shadow-2xl py-2 z-50 text-xs text-white">
                  <div className="px-4 py-2 border-b border-[#1E4D2C] bg-[#0A2615]">
                    <p className="font-bold text-white text-sm">{currentUser}</p>
                    <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Bally Jute Operator</p>
                  </div>
                  {hasModulePermission('admindesk', effectiveAllowedModules, effectiveIsAdmin) && (
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleNavNavigation('admindesk');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#1E4D2C] text-white flex items-center gap-2 font-bold cursor-pointer transition-colors"
                    >
                      <span>⚙️ Admin Desk</span>
                    </button>
                  )}
                  {hasModulePermission('reports', effectiveAllowedModules, effectiveIsAdmin) && (
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleNavNavigation('reports');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#1E4D2C] text-white flex items-center gap-2 font-bold cursor-pointer transition-colors"
                    >
                      <span>📊 Report</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      window.dispatchEvent(new CustomEvent('app-close'));
                      localStorage.clear();
                      window.location.replace(window.location.pathname);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-rose-900/50 text-rose-300 flex items-center gap-2 font-bold cursor-pointer border-t border-[#1E4D2C] transition-colors"
                  >
                    <span>🚪 Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </header>

        {/* Form Body */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 min-w-0 p-2 sm:p-4 bg-[#F4EFE6]/70 w-full max-w-full main-content">
          {children}
          <NotificationCenter
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
          />
          <UniversalAuditLogModal
            isOpen={isAuditLogOpen}
            onClose={() => setIsAuditLogOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}

export function LegacyFieldset({ legend, children, className }: { legend: string, children: React.ReactNode, className?: string }) {
  return (
    <fieldset className={cn("border border-[#D6CAA8] rounded-xl p-4 pt-2.5 bg-[#FAF7F0] shadow-xs relative hover:border-[#1E331B] transition-colors", className)}>
      <legend className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-[#1E331B] tracking-wider bg-[#EAE2D2] rounded-md border border-[#D6CAA8] shadow-2xs">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function LegacyButton({ label, icon: Icon, onClick, active, variant = 'default', children, className }: any) {
  const isCustom = !!children;
  return (
    <button 
      onClick={onClick}
      className={cn(
        "bg-[#FAF7F0] border border-[#D6CAA8] rounded-lg shadow-2xs hover:shadow-xs active:scale-[0.98] px-3.5 py-1.5 text-[#1E331B] transition-all font-semibold cursor-pointer hover:bg-[#EAE2D2] hover:border-[#1E331B]",
        !isCustom && "flex flex-col items-center min-w-[80px]",
        active && "bg-[#1E331B] border-[#1E331B] text-[#FAF7F0] shadow-inner font-bold",
        variant === 'danger' && "text-rose-700 bg-rose-50/50 hover:bg-rose-100 border-rose-300",
        className
      )}
    >
      {children ? children : (
        <>
          {Icon && <Icon className={cn("h-4 w-4 mb-1 transition-transform group-hover:scale-110", active ? "text-[#FAF7F0]" : "text-[#5A6E54]")} />}
          <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
        </>
      )}
    </button>
  );
}

