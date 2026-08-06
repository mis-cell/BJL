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
  Lock
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
      label: 'T.M.R To M.R',
      icon: ShieldCheck,
      subItems: [
        { id: 'tmr', label: 'TEMPORARY M.R', icon: Clock, pageId: 'amad' },
        { id: 'material_inspection', label: 'Material Inspection', icon: ShieldCheck, pageId: 'material_inspection' },
        { id: 'satta_mismatch', label: 'Satta Mismatch', icon: AlertTriangle, pageId: 'mismatch' },
        { id: 'material_mismatch', label: 'Material Mismatch', icon: AlertTriangle, pageId: 'material_mismatch' },
        { id: 'final_mr', label: 'Final M.R', icon: CheckCircle2, pageId: 'final_arrival' },
      ]
    },
    {
      id: 'club_payment',
      label: 'Club P.O To Payment',
      icon: Wallet,
      subItems: [
        { id: 'club_po', label: 'Club P.O & M.R', icon: Link, pageId: 'club_po_mr' },
        { id: 'mr_settlement', label: 'M.R Settlement', icon: FileCheck, pageId: 'mr_settlement' },
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
        { id: 'mr_archive', label: 'FINAL M.R ARCHIVE', icon: Archive, pageId: 'mr_archive' },
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
    <div className="bg-[#F8F6F1] h-full w-full overflow-auto min-w-[1200px] font-sans selection:bg-[#174C2C] selection:text-white flex flex-col">
      {/* Window Wrapper */}
      <div className="flex-1 flex flex-col border border-[#E5E7EB] bg-[#F8F6F1] overflow-auto shadow-xl">
        
        {/* 1. Header (Premium White Header - 90px Height) */}
        <header className="h-[90px] min-h-[90px] bg-white border-b border-[#E5E7EB] px-6 flex items-center justify-between shrink-0 shadow-xs relative z-30">
          
          {/* Left: Company Logo & Brand Name */}
          <div 
            onClick={() => handleNavNavigation('dashboard')} 
            className="flex items-center gap-3.5 cursor-pointer group select-none shrink-0"
          >
            {/* Company Logo Image from Cloudinary - Maintain Aspect Ratio */}
            <img 
              src="https://res.cloudinary.com/x6tw39wi/image/upload/v1786000718/ballymil_icon_qbpvkn.png" 
              alt="Bally Jute Limited Logo" 
              className="h-14 w-auto object-contain shrink-0 transition-transform group-hover:scale-105" 
            />

            <div>
              <h1 className="font-serif text-2xl font-black text-[#174C2C] tracking-tight leading-none group-hover:text-[#236e40] transition-colors">
                Bally Jute Limited
              </h1>
              <p className="text-[10px] font-mono text-[#D4AF37] tracking-[0.25em] font-extrabold uppercase mt-1">
                ESTD. 1979
              </p>
            </div>
          </div>

          {/* Center: Vintage Factory Illustration Badge */}
          <div className="hidden xl:flex items-center gap-3 px-5 py-2 bg-[#F8F6F1] border border-[#E2DFD5] rounded-xl relative overflow-hidden shadow-2xs max-w-md pointer-events-none">
            <img 
              src="https://res.cloudinary.com/x6tw39wi/image/upload/v1785928946/icon_vffvx9.png" 
              alt="Vintage Factory Illustration" 
              className="absolute right-0 top-0 bottom-0 h-full w-28 object-contain opacity-25 filter sepia pointer-events-none" 
            />
            <div>
              <span className="font-serif font-extrabold text-xs text-[#174C2C] uppercase tracking-wider block">
                Bally Jute Mill #1
              </span>
              <span className="font-mono text-[9px] text-[#64748B] font-semibold uppercase tracking-tight block">
                Industrial Manufacturing & Raw Material ERP Console
              </span>
            </div>
          </div>

          {/* Right: Notifications, Window Controls & Profile Dropdown */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Center Button */}
            <button
              onClick={() => setIsNotifOpen(true)}
              title="Notification & Highlight Center"
              className="h-8 px-3 bg-amber-50 hover:bg-amber-100 text-[#174C2C] border border-amber-300/80 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-xs gap-1.5 relative"
            >
              <Bell className="h-4 w-4 text-[#D4AF37]" />
              <span className="hidden sm:inline font-mono uppercase text-[11px] text-[#174C2C]">Notif Center</span>
              {unreadCount > 0 && (
                <span className="bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Window Controls (Back, Minimize, Maximize, Close) */}
            <div className="flex items-center gap-1 bg-[#F8F6F1] p-1 rounded-lg border border-[#E5E7EB]">
              <button 
                onClick={handleBackClick}
                title="Back (Esc)"
                className="h-6 w-6 bg-white hover:bg-slate-100 text-[#174C2C] border border-slate-200 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
              <button 
                onClick={handleMinimizeClick}
                title="Minimize"
                className="h-6 w-6 bg-white hover:bg-slate-100 text-[#174C2C] border border-slate-200 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer pb-0.5 shadow-2xs"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={handleMaximizeClick}
                title="Maximize / Restore"
                className="h-6 w-6 bg-white hover:bg-slate-100 text-[#174C2C] border border-slate-200 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Square className="h-3 w-3" />
              </button>
              <button 
                onClick={handleCloseClick}
                title="Close"
                className="h-6 w-6 bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Admin User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 bg-[#F8F6F1] hover:bg-[#EAE2D2]/60 border border-[#E5E7EB] rounded-full px-3 py-1 text-xs font-semibold text-[#1E293B] transition-colors cursor-pointer shadow-2xs"
              >
                <div className="w-7 h-7 rounded-full bg-[#174C2C] text-[#D4AF37] flex items-center justify-center text-xs font-bold shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left hidden sm:block">
                  <span className="block text-xs font-bold leading-tight text-[#1E293B]">{currentUser}</span>
                  <span className="block text-[9px] font-mono text-[#D4AF37] font-semibold">ADMINISTRATOR</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              </button>

              {/* Profile Menu Dropdown Overlay */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-[#E5E7EB] rounded-xl shadow-xl py-2 z-50 text-xs text-[#1E293B]">
                  <div className="px-4 py-2 border-b border-[#E5E7EB] bg-[#F8F6F1]/50">
                    <p className="font-bold text-[#174C2C]">{currentUser}</p>
                    <p className="text-[10px] text-[#64748B] font-mono">Bally Jute Console Admin</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleNavNavigation('admindesk');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#F8F6F1] flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <span>⚙️ System Admin Desk</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleNavNavigation('reports');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#F8F6F1] flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <span>📊 Management Reports</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 2. Top Horizontal Navigation Bar (No Sidebar) */}
        <nav className="bg-[#FAF8F5] border-b border-[#E5E7EB] px-6 py-1.5 flex items-center justify-between shrink-0 shadow-2xs relative z-20">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {navMenuItems.map((menu) => {
              const IconComp = menu.icon;
              const hasSubItems = menu.subItems && menu.subItems.length > 0;
              const isDropdownOpen = activeMenuDropdown === menu.id;

              if (!hasSubItems) {
                const isActive = activeNavTab === menu.pageId;
                return (
                  <button
                    key={menu.id}
                    onClick={() => handleNavNavigation(menu.pageId!)}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all relative cursor-pointer group whitespace-nowrap",
                      isActive
                        ? "text-[#174C2C] bg-white border border-[#E5E7EB] shadow-2xs"
                        : "text-[#64748B] hover:text-[#174C2C] hover:bg-white/60"
                    )}
                  >
                    <IconComp className={cn(
                      "w-4 h-4 transition-transform group-hover:scale-110",
                      isActive ? "text-[#174C2C]" : "text-[#64748B]"
                    )} />
                    <span className="text-[13px] tracking-tight">{menu.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#174C2C] rounded-full" />
                    )}
                  </button>
                );
              }

              return (
                <div 
                  key={menu.id}
                  className="relative nav-dropdown-container"
                  onMouseEnter={() => setActiveMenuDropdown(menu.id)}
                  onMouseLeave={() => setActiveMenuDropdown(null)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuDropdown(isDropdownOpen ? null : menu.id);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer group select-none whitespace-nowrap",
                      isDropdownOpen
                        ? "text-[#174C2C] bg-white border border-[#E5E7EB] shadow-2xs"
                        : "text-[#64748B] hover:text-[#174C2C] hover:bg-white/60"
                    )}
                  >
                    <IconComp className="w-4 h-4 text-[#64748B] group-hover:text-[#174C2C] transition-colors" />
                    <span className="text-[13px] tracking-tight">{menu.label}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform text-[#64748B]", isDropdownOpen && "rotate-180 text-[#174C2C]")} />
                  </button>

                  {/* Sub-menu Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 pt-1 z-[100] min-w-[230px]">
                      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-2xl py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-3 py-1 border-b border-[#E5E7EB] mb-1 bg-[#F8F6F1]">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                            {menu.label}
                          </span>
                        </div>
                        {menu.subItems.map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleNavNavigation(sub.pageId);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavNavigation(sub.pageId);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#174C2C] hover:text-white flex items-center gap-2.5 text-xs font-semibold text-[#1E293B] transition-colors cursor-pointer group/item"
                            >
                              <div className="w-6 h-6 rounded-md bg-[#F8F6F1] group-hover/item:bg-white/20 group-hover/item:text-white text-[#174C2C] flex items-center justify-center transition-colors shrink-0">
                                <SubIcon className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate font-bold text-[12px] uppercase tracking-tight">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Form / Content Body */}
        <div className="flex-1 overflow-auto p-5 bg-[#F8F6F1]">
          {children}
          <NotificationCenter
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
          />
        </div>

        {/* 3. Status Footer (Height 60px - Dark Green #174C2C) */}
        <footer className="h-[60px] min-h-[60px] bg-[#174C2C] text-white px-6 flex items-center justify-between shrink-0 border-t border-[#0F351E] text-xs font-mono select-none">
          {/* Left: Online Indicator & Active Tab */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#103A20] px-3 py-1.5 rounded-lg border border-[#235E39]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
              <span className="font-extrabold text-[11px] text-emerald-300 tracking-wider">SYSTEM ONLINE</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-[#103A20] px-3 py-1.5 rounded-lg border border-[#235E39]">
              <span className="text-[10px] text-emerald-200/70 uppercase">OPEN MODULE:</span>
              <span className="font-extrabold text-[11px] text-amber-300 uppercase">{activeNavTab.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Center: System Title */}
          <div className="hidden lg:block text-center font-bold text-xs tracking-wider text-emerald-100">
            BALLY JUTE LIMITED • SAUDA DESK CONSOLE • <span className="text-amber-300 font-extrabold">v2.4.0</span>
          </div>

          {/* Right: Clock, FY, Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-[#103A20] px-3 py-1.5 rounded-lg border border-[#235E39]">
              <span className="text-[10px] text-emerald-200/70">F.Y:</span>
              <span className="font-bold text-amber-300">2026-2027</span>
            </div>
            <div className="bg-[#103A20] px-3 py-1.5 rounded-lg border border-[#235E39] text-amber-300 font-bold text-xs">
              {currentTime.toLocaleTimeString()}
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('app-logout'))}
              className="px-3 py-1.5 bg-rose-800/80 hover:bg-rose-700 text-white border border-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Logout session"
            >
              Logout
            </button>
          </div>
        </footer>

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

