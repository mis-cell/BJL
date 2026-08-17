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
  ClipboardCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useHeartbeat } from '../hooks/useHeartbeat';
import NotificationCenter from './NotificationCenter';
import { getCurrentUserContext } from '../lib/permissions';

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
  onNavClick
}: LegacyLayoutProps) {
  const isOnline = useHeartbeat();
  const [currentTime, setCurrentTime] = React.useState(() => new Date());
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(3);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [activeMenuDropdown, setActiveMenuDropdown] = React.useState<string | null>(null);

  const currentUser = getCurrentUserContext().username || "Admin User";
  
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
        { id: 'sms', label: 'SMS', icon: MessageSquare, pageId: 'sms_sauda' },
        { id: 'sauda', label: 'Sauda', icon: HandCoins, pageId: 'sauda' },
        { id: 'sauda_check', label: 'Sauda Check Point', icon: FileText, pageId: 'po' },
        { id: 'final_po', label: 'Final P.O', icon: FileText, pageId: 'final_po' },
      ]
    },
    {
      id: 'tmr_mr',
      label: 'Temporary Arrival To Final Arrival',
      icon: ShieldCheck,
      subItems: [
        { id: 'tmr', label: 'TEMPORARY ARRIVAL', icon: Clock, pageId: 'amad' },
        { id: 'final_mr', label: 'FINAL ARRIVAL', icon: CheckCircle2, pageId: 'final_arrival' },
        { id: 'inspection', label: 'INSPECTION', icon: ClipboardCheck, pageId: 'inspection' },
        { id: 'material_inspection', label: 'INSPECTION CHECKLIST', icon: ShieldCheck, pageId: 'material_inspection' },
        { id: 'satta_mismatch', label: 'SATTA MISMATCH', icon: AlertTriangle, pageId: 'mismatch' },
        { id: 'material_mismatch', label: 'MATERIAL MISMATCH', icon: AlertTriangle, pageId: 'material_mismatch' },
      ]
    },
    {
      id: 'club_payment',
      label: 'Club P.O To Payment',
      icon: Wallet,
      subItems: [
        { id: 'club_po', label: 'Club P.O & Arrival', icon: Link, pageId: 'club_po_mr' },
        { id: 'mr_settlement', label: 'Settlement', icon: FileCheck, pageId: 'mr_settlement' },
        { id: 'payment', label: 'Payment', icon: Wallet, pageId: 'payment' },
      ]
    },
    {
      id: 'material_inventory',
      label: 'Material Issue To Inventory',
      icon: Boxes,
      subItems: [
        { id: 'issue', label: 'Material Issue', icon: PackageCheck, pageId: 'issue' },
        { id: 'stock_inventory', label: 'Stock Inventory', icon: Layers, pageId: 'closing_stock' },
        { id: 'requisition', label: 'Requisition Desk', icon: ClipboardList, pageId: 'requisition_desk' },
        { id: 'weighbridge', label: 'Weight Bridge', icon: Scale, pageId: 'weight_bridge' },
      ]
    },
    {
      id: 'sys_admin',
      label: 'System Administration',
      icon: Lock,
      subItems: [
        { id: 'po_archive', label: 'FINAL P.O ARCHIVE', icon: Archive, pageId: 'po_archive' },
        { id: 'mr_archive', label: 'FINAL ARRIVAL ARCHIVE', icon: Archive, pageId: 'mr_archive' },
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      pageId: 'reports'
    }
  ];

  return (
    <div className="bg-[#F4EFE6] h-full w-full min-w-0 font-sans selection:bg-[#1E331B] selection:text-white flex flex-col">
      {/* Window Wrapper */}
      <div className="flex-1 flex flex-col border border-[#C5BA9E] bg-[#FAF7F0] shadow-xl overflow-visible">
        
        {/* Top Control Bar (Yellow/Black Hazard Striped Sub-header & Window Controls) */}
        <div className="relative bg-[#faf7f0] border-b border-[#FAF7F0] px-2 sm:px-3.5 py-1.5 flex items-center justify-between text-white shrink-0 shadow-xs z-30 w-full min-w-0 gap-2">
          {/* Left Brand Logo Area */}
          <div 
            onClick={() => handleNavNavigation('dashboard')} 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0 flex-1"
          >
            {/* BJ Monogram Badge */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#1E331B] to-[#11220F] text-[#D4AF37] font-serif font-black text-xs sm:text-sm flex items-center justify-center shadow-sm border border-[#2D4D28] group-hover:border-[#D4AF37] transition-all shrink-0">
              BJ
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-sm sm:text-2xl font-bold text-[#1E331B] tracking-tight leading-none group-hover:text-[#3E5C38] transition-colors truncate">
                Bally Jute Limited
              </h1>
              <p className="text-[8px] sm:text-[9px] font-mono text-[#5A6E54] tracking-[0.15em] sm:tracking-[0.25em] uppercase font-semibold mt-0.5 truncate">
                ESTD. 1979
              </p>
            </div>
          </div>

          <div className="flex gap-1 sm:gap-1.5 shrink-0 z-10 items-center">
             <button 
               onClick={handleMinimizeClick}
               title="Minimize"
               className="h-5 w-5 bg-[#274024] hover:bg-[#345230] text-[#E2EDDE] border border-[#486343] rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer pb-0.5"
             >
               <Minus className="h-3 w-3" />
             </button>
             <button 
               onClick={handleMaximizeClick}
               title="Maximize / Restore"
               className="h-5 w-5 bg-[#274024] hover:bg-[#345230] text-[#E2EDDE] border border-[#486343] rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
             >
               <Square className="h-2.5 w-2.5" />
             </button>
             <button 
               onClick={handleCloseClick}
               title="Close"
               className="h-5 w-5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
             >
               <X className="h-3 w-3" />
             </button>
          </div>
        </div>

        {/* Main Header & Navigation Bar */}
        <header className="bg-[#FAF7F0] border-b border-[#D6CAA8] px-2 sm:px-4 py-1.5 flex flex-wrap items-center justify-between shrink-0 shadow-sm relative z-50 gap-2 w-full min-w-0">
          
          {/* Top Navigation Menu Bar with Sub-Menu Dropdowns */}
          <nav className="flex items-center gap-1 flex-wrap py-0.5 min-w-0 flex-1 relative z-50 max-w-full">
            {navMenuItems.map((menu) => {
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
                      "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md text-xs font-semibold transition-all relative cursor-pointer group max-w-full min-w-0",
                      isActive
                        ? "text-[#1E331B] bg-[#EAE2D2] font-bold shadow-xs"
                        : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#F3ECE0]"
                    )}
                  >
                    <IconComp className={cn(
                      "w-3.5 h-3.5 transition-transform group-hover:scale-110 shrink-0",
                      isActive ? "text-[#1E331B] stroke-[2.5]" : "text-[#7A8A74]"
                    )} />
                    <span className="text-[11px] sm:text-[12.5px] tracking-tight truncate max-w-[120px] sm:max-w-none">{menu.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#1E331B] rounded-full" />
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
                      "flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer group select-none max-w-full min-w-0",
                      isDropdownOpen
                        ? "text-[#1E331B] bg-[#EAE2D2] font-bold shadow-xs"
                        : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#F3ECE0]"
                    )}
                  >
                    <IconComp className="w-3.5 h-3.5 text-[#7A8A74] group-hover:text-[#1E331B] transition-colors shrink-0" />
                    <span className="text-[11px] sm:text-[12.5px] tracking-tight truncate max-w-[120px] sm:max-w-none">{menu.label}</span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform text-[#7A8A74] shrink-0", isDropdownOpen && "rotate-180 text-[#1E331B]")} />
                  </button>

                  {/* Sub-menu Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 pt-1 z-[999] min-w-[200px] max-w-[calc(100vw-16px)]">
                      <div className="bg-[#FAF7F0] border border-[#C5BA9E] rounded-xl shadow-2xl py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-3 py-1 border-b border-[#EAE2D2] mb-1 bg-[#F3ECE0]/50">
                          <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[#5A6E54]">
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
                              className="w-full text-left px-3 py-2 hover:bg-[#1E331B] hover:text-[#FAF7F0] flex items-center gap-2.5 text-xs font-medium text-[#1E331B] transition-colors cursor-pointer group/item"
                            >
                              <div className="w-5 h-5 rounded-md bg-[#EAE2D2]/80 group-hover/item:bg-[#FAF7F0] group-hover/item:text-[#1E331B] text-[#1E331B] flex items-center justify-center transition-colors shrink-0">
                                <SubIcon className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate font-semibold text-[12px] uppercase tracking-tight">{sub.label}</span>
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
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold shadow-2xs transition-all",
                isOnline 
                  ? "bg-emerald-100/80 border-emerald-300 text-emerald-800" 
                  : "bg-rose-100/80 border-rose-300 text-rose-800"
              )}
              title={isOnline ? "Supabase Realtime Live Data Sync Active" : "Reconnecting to Supabase Live Sync..."}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span className="hidden xs:inline">Live</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-600"></span>
                  <span className="hidden xs:inline">Offline</span>
                </>
              )}
            </div>

            {/* Notification Badge Bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 rounded-full bg-[#EAE2D2]/60 hover:bg-[#D6CAA8]/60 text-[#1E331B] border border-[#D6CAA8] transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Admin User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-2 bg-[#EAE2D2]/60 hover:bg-[#D6CAA8]/60 border border-[#D6CAA8] rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold text-[#1E331B] transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#1E331B] text-[#FAF7F0] flex items-center justify-center text-[10px] sm:text-[11px] font-bold">
                  <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="hidden sm:inline font-bold">{currentUser}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#5A6E54]" />
              </button>

              {/* Profile Menu Dropdown Overlay */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#FAF7F0] border border-[#C5BA9E] rounded-xl shadow-xl py-2 z-50 text-xs text-[#1E331B]">
                  <div className="px-4 py-2 border-b border-[#EAE2D2]">
                    <p className="font-bold">{currentUser}</p>
                    <p className="text-[10px] text-[#5A6E54]">Bally Jute Operator</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleNavNavigation('admindesk');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#EAE2D2] flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <span>⚙️ Admin Desk</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleNavNavigation('reports');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#EAE2D2] flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <span>📊 System Reports</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </header>

        {/* Form Body */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 bg-[#F4EFE6]/70 w-full max-w-full min-w-0">
          {children}
          <NotificationCenter
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
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

