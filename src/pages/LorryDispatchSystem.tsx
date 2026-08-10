import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Scale,
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Calendar,
  Building,
  MapPin,
  Layers,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  X,
  FileText,
  Bell,
  Settings,
  Users,
  Lock,
  LogOut,
  Sliders,
  Database,
  Printer,
  ChevronRight,
  Navigation,
  ShieldCheck,
  Shield,
  Activity,
  Download,
  Check,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Zap,
  PackageCheck,
  Smartphone,
  EyeOff,
  Radio,
  FileDown
} from "lucide-react";
import LegacyLayout, {
  LegacyFieldset,
  LegacyButton
} from "../components/LegacyLayout";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ==========================================
// TYPES & INTERFACES
// ==========================================

export type UserRole =
  | "SUPER_ADMIN"
  | "MAIN_GATE"
  | "MILL_WEIGHTMENT"
  | "ELECTRIC_WEIGHTMENT"
  | "STORE_DEPT";

export type DepartmentType = "Jute" | "Store" | "Finish Good" | "Other";

export type LorryStatus =
  | "GATE_ENTRY"
  | "WAITING_FOR_MILL_GROSS"
  | "ELECTRIC_GROSS_PENDING"
  | "WAITING_FOR_UNLOADING"
  | "MILL_TARE_PENDING"
  | "ELECTRIC_TARE_PENDING"
  | "STORE_PENDING"
  | "FINISH_GOOD_PENDING"
  | "OTHER_PENDING"
  | "READY_FOR_GATE_EXIT"
  | "COMPLETED";

export interface LorryRecord {
  id: string;
  gatePassNo: string;
  lorryNo: string;
  driverPhone: string;
  department: DepartmentType;
  broker: string;
  quality: string;
  mokam: string;
  marka: string;
  status: LorryStatus;
  
  // Timestamps
  inTime: string;
  outTime?: string;
  
  // Weights (in KG)
  millGrossWeight?: number;
  millGrossTime?: string;
  
  electricGrossWeight?: number;
  electricGrossTime?: string;
  
  millTareWeight?: number;
  millTareTime?: string;
  
  electricTareWeight?: number;
  electricTareTime?: string;

  // Computed Net Weights
  millNetWeight?: number;
  electricNetWeight?: number;
  finalNetWeight?: number;
  
  // Approval metadata
  deptApprovedBy?: string;
  deptApprovedTime?: string;
  remarks?: string;
  
  // GPS tag at entry
  entryGpsLocation?: { lat: number; lng: number; distanceMeters: number };
}

export interface AppAlert {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  targetRole: UserRole | "ALL";
  lorryNo?: string;
  gatePassNo?: string;
  read: boolean;
  type: "info" | "success" | "warning" | "alert";
}

export interface SystemSettings {
  millZeroOffsetKg: number;
  electricZeroOffsetKg: number;
  inactivityTimeoutMinutes: number;
  geofenceRadiusMeters: number;
  millLat: number;
  millLng: number;
  enforceGeofence: boolean;
  allowScreenCapture: boolean;
}

export interface MasterOptions {
  brokers: string[];
  qualities: string[];
  mokams: string[];
  markas: string[];
}

export interface SystemUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  active: boolean;
  lastActive: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  role: UserRole;
  action: string;
  details: string;
}

// ==========================================
// DEFAULT MASTER & INITIAL DATA
// ==========================================

const DEFAULT_SETTINGS: SystemSettings = {
  millZeroOffsetKg: 0,
  electricZeroOffsetKg: 0,
  inactivityTimeoutMinutes: 5,
  geofenceRadiusMeters: 500,
  millLat: 22.6500, // Bally Jute Mill
  millLng: 88.3400,
  enforceGeofence: true,
  allowScreenCapture: false,
};

const DEFAULT_MASTERS: MasterOptions = {
  brokers: ["Jute Traders India", "Bally Raw Jute Syndicate", "Eastern Fiber Co", "Bengal Jute Suppliers", "Ganga Commercial"],
  qualities: ["TD-5 Super", "TD-4 Grade A", "W-5 White Jute", "B-Bottom Raw", "Mesta Fiber Grade I", "Hessian Grade B"],
  mokams: ["Cuttack Yard", "Forbesganj Depot", "Kishanganj Mandi", "Purnea Hub", "Samsi Terminal"],
  markas: ["BJL-SUPER", "STAR-JUTE", "GOLD-BALE", "BALLY-PRIME", "EAGLE-FIBER"],
};

const DEFAULT_USERS: SystemUser[] = [
  { id: "usr_1", username: "admin", name: "Super Admin (System)", role: "SUPER_ADMIN", active: true, lastActive: "Just now" },
  { id: "usr_2", username: "gate1", name: "Ramesh Sharma (Main Gate)", role: "MAIN_GATE", active: true, lastActive: "2 mins ago" },
  { id: "usr_3", username: "mill_wb", name: "Suresh Patel (Mill Weighment)", role: "MILL_WEIGHTMENT", active: true, lastActive: "5 mins ago" },
  { id: "usr_4", username: "elec_wb", name: "Amit Mukherji (Electric WB)", role: "ELECTRIC_WEIGHTMENT", active: true, lastActive: "1 min ago" },
  { id: "usr_5", username: "store_mgr", name: "Pradeep Ghosh (Store/Yard)", role: "STORE_DEPT", active: true, lastActive: "10 mins ago" },
];

const INITIAL_LORRIES: LorryRecord[] = [
  {
    id: "lorry_101",
    gatePassNo: "GP-2026-0810-001",
    lorryNo: "WB-04-E-8821",
    driverPhone: "+91 98310 12345",
    department: "Jute",
    broker: "Jute Traders India",
    quality: "TD-5 Super",
    mokam: "Forbesganj Depot",
    marka: "BJL-SUPER",
    status: "READY_FOR_GATE_EXIT",
    inTime: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    millGrossWeight: 38450,
    millGrossTime: new Date(Date.now() - 3600000 * 2.2).toISOString(),
    electricGrossWeight: 38480,
    electricGrossTime: new Date(Date.now() - 3600000 * 2.0).toISOString(),
    millTareWeight: 14200,
    millTareTime: new Date(Date.now() - 3600000 * 0.8).toISOString(),
    electricTareWeight: 14210,
    electricTareTime: new Date(Date.now() - 3600000 * 0.3).toISOString(),
    millNetWeight: 24250,
    electricNetWeight: 24270,
    finalNetWeight: 24260,
    remarks: "Raw jute bales verified in good condition.",
  },
  {
    id: "lorry_102",
    gatePassNo: "GP-2026-0810-002",
    lorryNo: "WB-25-C-4410",
    driverPhone: "+91 98301 98765",
    department: "Jute",
    broker: "Bally Raw Jute Syndicate",
    quality: "W-5 White Jute",
    mokam: "Cuttack Yard",
    marka: "STAR-JUTE",
    status: "MILL_TARE_PENDING",
    inTime: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    millGrossWeight: 42100,
    millGrossTime: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    electricGrossWeight: 42120,
    electricGrossTime: new Date(Date.now() - 3600000 * 1.0).toISOString(),
    remarks: "Currently unloading at Jute Yard #3.",
  },
  {
    id: "lorry_103",
    gatePassNo: "GP-2026-0810-003",
    lorryNo: "WB-19-B-1192",
    driverPhone: "+91 97482 33441",
    department: "Store",
    broker: "Eastern Fiber Co",
    quality: "Machine Spare Parts",
    mokam: "Kishanganj Mandi",
    marka: "BALLY-PRIME",
    status: "STORE_PENDING",
    inTime: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    remarks: "Store hardware delivery.",
  },
];

// Calculate Haversine distance in meters
function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function LorryDispatchSystem({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  // 1. STATE MANAGEMENT (OFFLINE-FIRST + LOCALSTORAGE RESILIENCE)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("MAIN_GATE");
  const [activeTab, setActiveTab] = useState<"operations" | "settings" | "masters" | "users" | "audit">("operations");
  
  // System Data
  const [lorries, setLorries] = useState<LorryRecord[]>(() => {
    const saved = localStorage.getItem("bjl_lorries");
    return saved ? JSON.parse(saved) : INITIAL_LORRIES;
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem("bjl_settings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [masters, setMasters] = useState<MasterOptions>(() => {
    const saved = localStorage.getItem("bjl_masters");
    return saved ? JSON.parse(saved) : DEFAULT_MASTERS;
  });

  const [users, setUsers] = useState<SystemUser[]>(() => {
    const saved = localStorage.getItem("bjl_users");
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  const [alerts, setAlerts] = useState<AppAlert[]>(() => {
    const saved = localStorage.getItem("bjl_alerts");
    return saved ? JSON.parse(saved) : [
      {
        id: "alt_1",
        timestamp: new Date().toISOString(),
        title: "System Initialization",
        message: "Lorry Weightment & Dispatch System Online (Bally Jute Mill)",
        targetRole: "ALL",
        read: false,
        type: "info"
      }
    ];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem("bjl_audit_logs");
    return saved ? JSON.parse(saved) : [
      {
        id: "log_1",
        timestamp: new Date().toISOString(),
        username: "admin",
        role: "SUPER_ADMIN",
        action: "SYSTEM_BOOT",
        details: "Lorry dispatch station initialized with geofence protection"
      }
    ];
  });

  // UI Modals & State
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [isGpsSimOpen, setIsGpsSimOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedLorryForReceipt, setSelectedLorryForReceipt] = useState<LorryRecord | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isScreenBlurred, setIsScreenBlurred] = useState(false);

  // Simulated GPS Coordinates of active user session
  const [userGps, setUserGps] = useState<{ lat: number; lng: number; label: string }>({
    lat: 22.6500, // Bally Jute Mill inside
    lng: 88.3400,
    label: "Inside Jute Mill Yard (0m)",
  });

  // Search & Filter for Lorries List
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  // Inactivity Auto-logout tracker
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem("bjl_lorries", JSON.stringify(lorries));
  }, [lorries]);

  useEffect(() => {
    localStorage.setItem("bjl_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("bjl_masters", JSON.stringify(masters));
  }, [masters]);

  useEffect(() => {
    localStorage.setItem("bjl_users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem("bjl_alerts", JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem("bjl_audit_logs", JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Helper to add audit logs
  const logAuditAction = (action: string, details: string) => {
    const newLog: AuditLog = {
      id: "log_" + Date.now(),
      timestamp: new Date().toISOString(),
      username: currentUserRole.toLowerCase(),
      role: currentUserRole,
      action,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Helper to trigger active real-time notification
  const triggerNotification = (
    title: string,
    message: string,
    targetRole: UserRole | "ALL",
    type: "info" | "success" | "warning" | "alert" = "info",
    lorryNo?: string,
    gatePassNo?: string
  ) => {
    const newAlert: AppAlert = {
      id: "alt_" + Date.now(),
      timestamp: new Date().toISOString(),
      title,
      message,
      targetRole,
      read: false,
      type,
      lorryNo,
      gatePassNo,
    };
    setAlerts((prev) => [newAlert, ...prev]);
  };

  // Geofence Distance Calculation
  const currentDistanceMeters = useMemo(() => {
    return getHaversineDistance(
      userGps.lat,
      userGps.lng,
      settings.millLat,
      settings.millLng
    );
  }, [userGps, settings.millLat, settings.millLng]);

  const isInsideGeofence = currentDistanceMeters <= settings.geofenceRadiusMeters;

  // 2. INACTIVITY AUTO-LOGOUT MONITOR
  useEffect(() => {
    const resetTimer = () => {
      setInactivitySeconds(0);
      setShowInactivityWarning(false);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((evt) => window.addEventListener(evt, resetTimer));

    const interval = setInterval(() => {
      setInactivitySeconds((prev) => {
        const next = prev + 1;
        const maxSecs = settings.inactivityTimeoutMinutes * 60;
        
        if (next >= maxSecs - 30 && next < maxSecs) {
          setShowInactivityWarning(true);
        } else if (next >= maxSecs) {
          // Auto logout
          logAuditAction("AUTO_LOGOUT", "Session terminated due to operator inactivity");
          setCurrentUserRole("MAIN_GATE");
          setInactivitySeconds(0);
          setShowInactivityWarning(false);
          alert("Your session was automatically logged out due to inactivity.");
        }
        return next;
      });
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      clearInterval(interval);
    };
  }, [settings.inactivityTimeoutMinutes]);

  // 3. SCREEN & SCREENSHOT CAPTURE PROTECTION
  useEffect(() => {
    if (settings.allowScreenCapture) {
      setIsScreenBlurred(false);
      return;
    }

    const handleBlur = () => setIsScreenBlurred(true);
    const handleFocus = () => setIsScreenBlurred(false);

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [settings.allowScreenCapture]);

  // Unread Alerts Count
  const unreadAlertsCount = useMemo(() => {
    return alerts.filter(
      (a) =>
        !a.read &&
        (a.targetRole === "ALL" || a.targetRole === currentUserRole)
    ).length;
  }, [alerts, currentUserRole]);

  // Filtered Lorries List
  const filteredLorries = useMemo(() => {
    return lorries.filter((l) => {
      const matchSearch =
        l.lorryNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.gatePassNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.broker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.driverPhone.includes(searchTerm);

      const matchStatus =
        statusFilter === "ALL" ? true : l.status === statusFilter;

      const matchDept =
        deptFilter === "ALL" ? true : l.department === deptFilter;

      return matchSearch && matchStatus && matchDept;
    });
  }, [lorries, searchTerm, statusFilter, deptFilter]);

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // A. MAIN GATE: ENTRY REGISTRATION
  const handleRegisterGateEntry = (formData: {
    lorryNo: string;
    driverPhone: string;
    department: DepartmentType;
    broker: string;
    quality: string;
    mokam: string;
    marka: string;
  }) => {
    if (settings.enforceGeofence && !isInsideGeofence) {
      alert(`GEOFENCE BREACH: You are ${currentDistanceMeters}m away from Bally Jute Mill. Geofence radius limit is ${settings.geofenceRadiusMeters}m.`);
      return;
    }

    const nextNumber = lorries.length + 1;
    const gatePassNo = `GP-2026-${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(nextNumber).padStart(3, "0")}`;

    let initialStatus: LorryStatus = "WAITING_FOR_MILL_GROSS";
    if (formData.department === "Store") initialStatus = "STORE_PENDING";
    else if (formData.department === "Finish Good") initialStatus = "FINISH_GOOD_PENDING";
    else if (formData.department === "Other") initialStatus = "OTHER_PENDING";

    const newRecord: LorryRecord = {
      id: "lorry_" + Date.now(),
      gatePassNo,
      lorryNo: formData.lorryNo.toUpperCase(),
      driverPhone: formData.driverPhone,
      department: formData.department,
      broker: formData.broker,
      quality: formData.quality,
      mokam: formData.mokam,
      marka: formData.marka,
      status: initialStatus,
      inTime: new Date().toISOString(),
      entryGpsLocation: {
        lat: userGps.lat,
        lng: userGps.lng,
        distanceMeters: currentDistanceMeters,
      },
    };

    setLorries((prev) => [newRecord, ...prev]);
    logAuditAction("GATE_ENTRY_REGISTERED", `Gate pass ${gatePassNo} generated for Lorry ${newRecord.lorryNo} (${formData.department})`);

    // Real-Time Notification
    if (formData.department === "Jute") {
      triggerNotification(
        "New Jute Lorry Arrived",
        `Lorry ${newRecord.lorryNo} (${gatePassNo}) registered at Main Gate. Ready for Mill Gross Weighment.`,
        "MILL_WEIGHTMENT",
        "info",
        newRecord.lorryNo,
        gatePassNo
      );
    } else {
      triggerNotification(
        `New ${formData.department} Lorry Arrived`,
        `Lorry ${newRecord.lorryNo} (${gatePassNo}) registered at Main Gate for ${formData.department} verification.`,
        "STORE_DEPT",
        "info",
        newRecord.lorryNo,
        gatePassNo
      );
    }

    alert(`Gate Pass Created Successfully!\nGate Pass No: ${gatePassNo}\nLorry: ${newRecord.lorryNo}`);
  };

  // B. WEIGHMENT ACTION (MILL & ELECTRIC GROSS / TARE)
  const handleSaveWeighment = (
    lorryId: string,
    station: "MILL" | "ELECTRIC",
    type: "GROSS" | "TARE",
    weightKg: number
  ) => {
    if (settings.enforceGeofence && !isInsideGeofence) {
      alert(`GEOFENCE BREACH: Weightment recording blocked. Device is ${currentDistanceMeters}m from Bally Jute Mill.`);
      return;
    }

    setLorries((prev) =>
      prev.map((l) => {
        if (l.id !== lorryId) return l;

        const updated = { ...l };
        const nowIso = new Date().toISOString();

        if (station === "MILL" && type === "GROSS") {
          updated.millGrossWeight = weightKg;
          updated.millGrossTime = nowIso;
          updated.status = "ELECTRIC_GROSS_PENDING";

          triggerNotification(
            "Jute Lorry Ready for Electric Weighment",
            `Lorry ${l.lorryNo} recorded Mill Gross: ${weightKg.toLocaleString()} kg. Proceeding to Electric Weighbridge.`,
            "ELECTRIC_WEIGHTMENT",
            "info",
            l.lorryNo,
            l.gatePassNo
          );
        } else if (station === "ELECTRIC" && type === "GROSS") {
          updated.electricGrossWeight = weightKg;
          updated.electricGrossTime = nowIso;
          updated.status = "MILL_TARE_PENDING";

          triggerNotification(
            "Electric Gross Recorded",
            `Lorry ${l.lorryNo} recorded Electric Gross: ${weightKg.toLocaleString()} kg. Unloading & pending Mill Tare.`,
            "MILL_WEIGHTMENT",
            "info",
            l.lorryNo,
            l.gatePassNo
          );
        } else if (station === "MILL" && type === "TARE") {
          updated.millTareWeight = weightKg;
          updated.millTareTime = nowIso;
          updated.status = "ELECTRIC_TARE_PENDING";

          if (updated.millGrossWeight) {
            updated.millNetWeight = updated.millGrossWeight - weightKg;
          }

          triggerNotification(
            "Mill Tare Recorded",
            `Lorry ${l.lorryNo} recorded Mill Tare: ${weightKg.toLocaleString()} kg. Proceeding for Electric Tare.`,
            "ELECTRIC_WEIGHTMENT",
            "info",
            l.lorryNo,
            l.gatePassNo
          );
        } else if (station === "ELECTRIC" && type === "TARE") {
          updated.electricTareWeight = weightKg;
          updated.electricTareTime = nowIso;
          updated.status = "READY_FOR_GATE_EXIT";

          if (updated.electricGrossWeight) {
            updated.electricNetWeight = updated.electricGrossWeight - weightKg;
          }

          // Final net weight average or standard
          if (updated.millNetWeight && updated.electricNetWeight) {
            updated.finalNetWeight = Math.round((updated.millNetWeight + updated.electricNetWeight) / 2);
          } else {
            updated.finalNetWeight = updated.electricNetWeight || updated.millNetWeight;
          }

          triggerNotification(
            "Lorry Ready for Gate Exit",
            `Lorry ${l.lorryNo} (${l.gatePassNo}) weighment complete. Ready for final Main Gate Exit.`,
            "MAIN_GATE",
            "success",
            l.lorryNo,
            l.gatePassNo
          );
        }

        logAuditAction(`${station}_${type}_SAVED`, `Lorry ${l.lorryNo}: Recorded ${station} ${type} = ${weightKg} kg`);
        return updated;
      })
    );
  };

  // C. DEPARTMENT UNLOAD / APPROVAL ACTION
  const handleDepartmentApprove = (lorryId: string) => {
    setLorries((prev) =>
      prev.map((l) => {
        if (l.id !== lorryId) return l;

        const updated: LorryRecord = {
          ...l,
          status: "READY_FOR_GATE_EXIT",
          deptApprovedBy: currentUserRole,
          deptApprovedTime: new Date().toISOString(),
        };

        logAuditAction("DEPT_UNLOAD_VERIFIED", `Department approved unloading for Lorry ${l.lorryNo}`);
        triggerNotification(
          "Department Verification Completed",
          `Lorry ${l.lorryNo} unloading verified by ${l.department} Department. Ready for Gate Exit.`,
          "MAIN_GATE",
          "success",
          l.lorryNo,
          l.gatePassNo
        );

        return updated;
      })
    );
  };

  // D. MAIN GATE OUT EXIT & RECEIPT
  const handleGateOutExit = (lorry: LorryRecord) => {
    const nowIso = new Date().toISOString();
    setLorries((prev) =>
      prev.map((l) => (l.id === lorry.id ? { ...l, status: "COMPLETED", outTime: nowIso } : l))
    );

    logAuditAction("GATE_OUT_COMPLETED", `Lorry ${lorry.lorryNo} gate-out completed`);
    setSelectedLorryForReceipt({ ...lorry, status: "COMPLETED", outTime: nowIso });
    setIsReceiptModalOpen(true);
  };

  // ==========================================
  // PDF & EXPORT GENERATORS
  // ==========================================

  // 1. Generate 3-Inch Weightment Receipt Slip PDF
  const generateReceiptSlipPdf = (lorry: LorryRecord) => {
    const doc = new jsPDF({
      unit: "mm",
      format: [76, 180], // 3-inch thermal slip size
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BALLY JUTE LIMITED", 38, 8, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Bally, Howrah - 711201, West Bengal", 38, 12, { align: "center" });
    doc.text("LORRY WEIGHMENT & DISPATCH SLIP", 38, 15, { align: "center" });

    doc.setLineWidth(0.3);
    doc.line(4, 17, 72, 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`GATE PASS: ${lorry.gatePassNo}`, 4, 21);
    doc.text(`LORRY NO: ${lorry.lorryNo}`, 4, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Date/In-Time: ${new Date(lorry.inTime).toLocaleString("en-IN")}`, 4, 29);
    doc.text(`Out-Time: ${lorry.outTime ? new Date(lorry.outTime).toLocaleString("en-IN") : "N/A"}`, 4, 33);
    doc.text(`Driver Phone: ${lorry.driverPhone}`, 4, 37);
    doc.text(`Department: ${lorry.department}`, 4, 41);
    doc.text(`Broker: ${lorry.broker}`, 4, 45);
    doc.text(`Quality: ${lorry.quality}`, 4, 49);
    doc.text(`Mokam: ${lorry.mokam} | Marka: ${lorry.marka}`, 4, 53);

    doc.line(4, 55, 72, 55);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("WEIGHMENT BREAKDOWN (KG)", 38, 59, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let y = 63;

    if (lorry.millGrossWeight) {
      doc.text(`Mill Gross Weight:`, 4, y);
      doc.text(`${lorry.millGrossWeight.toLocaleString()} kg`, 72, y, { align: "right" });
      y += 4;
    }
    if (lorry.millTareWeight) {
      doc.text(`Mill Tare Weight:`, 4, y);
      doc.text(`${lorry.millTareWeight.toLocaleString()} kg`, 72, y, { align: "right" });
      y += 4;
    }
    if (lorry.millNetWeight) {
      doc.setFont("helvetica", "bold");
      doc.text(`Mill Net Weight:`, 4, y);
      doc.text(`${lorry.millNetWeight.toLocaleString()} kg`, 72, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5;
    }

    if (lorry.electricGrossWeight) {
      doc.text(`Electric Gross Weight:`, 4, y);
      doc.text(`${lorry.electricGrossWeight.toLocaleString()} kg`, 72, y, { align: "right" });
      y += 4;
    }
    if (lorry.electricTareWeight) {
      doc.text(`Electric Tare Weight:`, 4, y);
      doc.text(`${lorry.electricTareWeight.toLocaleString()} kg`, 72, y, { align: "right" });
      y += 4;
    }
    if (lorry.electricNetWeight) {
      doc.setFont("helvetica", "bold");
      doc.text(`Electric Net Weight:`, 4, y);
      doc.text(`${lorry.electricNetWeight.toLocaleString()} kg`, 72, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5;
    }

    doc.line(4, y, 72, y);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`FINAL NET DISPATCH:`, 4, y);
    doc.text(`${(lorry.finalNetWeight || 0).toLocaleString()} KG`, 72, y, { align: "right" });

    y += 8;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("------------------------------------------------", 38, y, { align: "center" });
    y += 5;
    doc.text("Weighbridge Operator Signature", 4, y);
    doc.text("Driver Signature", 72, y, { align: "right" });

    y += 10;
    doc.setFontSize(6);
    doc.text("System Generated Slip • Bally Jute Mill Dispatch", 38, y, { align: "center" });

    doc.save(`Receipt_Slip_${lorry.gatePassNo}.pdf`);
  };

  // 2. Generate Shift Ledger PDF Report
  const generateShiftLedgerPdf = () => {
    const doc = new jsPDF("landscape");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("BALLY JUTE LIMITED - DISPATCH & WEIGHMENT SHIFT LEDGER", 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Date: ${new Date().toLocaleString("en-IN")}`, 14, 21);
    doc.text(`Total Lorries Count: ${lorries.length}`, 140, 21);

    const tableData = lorries.map((l, i) => [
      i + 1,
      l.gatePassNo,
      l.lorryNo,
      l.department,
      l.broker,
      l.quality,
      l.millGrossWeight ? `${l.millGrossWeight} kg` : "-",
      l.millTareWeight ? `${l.millTareWeight} kg` : "-",
      l.electricGrossWeight ? `${l.electricGrossWeight} kg` : "-",
      l.electricTareWeight ? `${l.electricTareWeight} kg` : "-",
      l.finalNetWeight ? `${l.finalNetWeight} kg` : "-",
      l.status,
    ]);

    autoTable(doc, {
      startY: 25,
      head: [
        [
          "#",
          "Gate Pass",
          "Lorry No",
          "Dept",
          "Broker",
          "Quality",
          "Mill Gross",
          "Mill Tare",
          "Elec Gross",
          "Elec Tare",
          "Net Wt",
          "Status",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
    });

    doc.save(`BJL_Shift_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // 3. Export CSV Log
  const exportCsvLog = () => {
    const headers = [
      "Gate Pass No",
      "Lorry No",
      "Driver Phone",
      "Department",
      "Broker",
      "Quality",
      "Mokam",
      "Marka",
      "Status",
      "In Time",
      "Out Time",
      "Mill Gross (KG)",
      "Mill Tare (KG)",
      "Mill Net (KG)",
      "Electric Gross (KG)",
      "Electric Tare (KG)",
      "Electric Net (KG)",
      "Final Net (KG)",
    ];

    const rows = lorries.map((l) => [
      l.gatePassNo,
      l.lorryNo,
      l.driverPhone,
      l.department,
      l.broker,
      l.quality,
      l.mokam,
      l.marka,
      l.status,
      l.inTime,
      l.outTime || "",
      l.millGrossWeight || "",
      l.millTareWeight || "",
      l.millNetWeight || "",
      l.electricGrossWeight || "",
      l.electricTareWeight || "",
      l.electricNetWeight || "",
      l.finalNetWeight || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Lorry_Dispatch_Log_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <LegacyLayout title="4.1 – Main Gate Lorry Entry & Exit" subtitle="Bally Jute Mill Gate Pass & Dispatch Management">
      <div className="relative w-full min-h-full bg-[#FAF7F0] text-[#1E331B] font-sans flex flex-col select-none overflow-x-hidden p-2 sm:p-4 space-y-4">
      
      {/* SCREEN CAPTURE PROTECTION OVERLAY (TRIGGERS WHEN FOCUS LOST IF PROTECTION ENABLED) */}
      {isScreenBlurred && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center text-center p-6 space-y-4">
          <ShieldAlert className="w-16 h-16 text-rose-500 animate-pulse" />
          <h2 className="text-2xl font-black uppercase text-rose-400 tracking-wide">
            SENSITIVE INDUSTRIAL DATA PROTECTED
          </h2>
          <p className="text-slate-300 max-w-md text-sm leading-relaxed">
            Screen capture & background recording is restricted by Bally Jute Mill security policy. Return focus to active browser tab to resume operations.
          </p>
        </div>
      )}

      {/* INACTIVITY WARNING BANNER */}
      {showInactivityWarning && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 font-bold text-xs flex items-center justify-between shadow-lg animate-bounce z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-950" />
            <span>
              INACTIVITY WARNING: Session will automatically lock in 30 seconds due to operator inactivity.
            </span>
          </div>
          <button
            onClick={() => setInactivitySeconds(0)}
            className="px-3 py-1 bg-slate-900 text-amber-300 rounded hover:bg-slate-800 text-[11px] uppercase tracking-wider"
          >
            I'm Active
          </button>
        </div>
      )}

      {/* ==========================================
          1. TOP NAVIGATION BAR (BASE THEME)
         ========================================== */}
      <header className="bg-[#EAE2D2] border border-[#C5BA9E] px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between shrink-0 shadow-sm rounded-xl gap-3 text-[#1E331B]">
        {/* Left Brand Title & Role Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-[#1E331B] text-[#FAF7F0] border border-[#2D4D28] rounded-xl shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight uppercase truncate font-mono text-[#1E331B]">
                Bally Jute Mill Dispatch
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 bg-[#1E331B]/10 border border-[#1E331B]/20 text-[#1E331B] rounded text-[10px] font-mono font-bold uppercase">
                v4.8 Live
              </span>
            </div>
            <p className="text-[11px] text-[#5A6E54] truncate">
              Active Station: <strong className="text-[#1E331B] uppercase">{currentUserRole.replace("_", " ")}</strong>
            </p>
          </div>
        </div>

        {/* Center Role Switcher Quick Pill */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#FAF7F0] p-1 border border-[#C5BA9E] rounded-xl">
          {(["SUPER_ADMIN", "MAIN_GATE", "MILL_WEIGHTMENT", "ELECTRIC_WEIGHTMENT", "STORE_DEPT"] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                setCurrentUserRole(r);
                logAuditAction("ROLE_SWITCH", `Switched active station view to ${r}`);
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer whitespace-nowrap",
                currentUserRole === r
                  ? "bg-[#1E331B] text-[#FAF7F0] shadow-md"
                  : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#EAE2D2]"
              )}
            >
              {r === "SUPER_ADMIN" ? "Admin" : r.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Right Action Controls: GPS Status, Bell Alerts, GPS Sim, Logout */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* GPS Geofence Status Pill */}
          <button
            onClick={() => setIsGpsSimOpen(true)}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer",
              isInsideGeofence
                ? "bg-emerald-100 border-emerald-400 text-emerald-900 hover:bg-emerald-200"
                : "bg-rose-100 border-rose-400 text-rose-900 hover:bg-rose-200"
            )}
            title="Click to open Geofence GPS Location Simulator"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">{userGps.label}</span>
            <span className="md:hidden">{isInsideGeofence ? "IN RANGE" : "OUT OF RANGE"}</span>
          </button>

          {/* Real-time Notification Bell */}
          <button
            onClick={() => setIsAlertDrawerOpen(true)}
            className="relative p-2 bg-[#FAF7F0] hover:bg-[#EAE2D2] border border-[#C5BA9E] rounded-xl text-[#1E331B] transition-colors cursor-pointer"
            title="Real-time Dispatch Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded-full animate-pulse">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Role selector dropdown for small screens */}
          <div className="lg:hidden">
            <select
              value={currentUserRole}
              onChange={(e) => setCurrentUserRole(e.target.value as UserRole)}
              className="bg-[#FAF7F0] border border-[#C5BA9E] text-[#1E331B] text-xs rounded-xl px-2 py-1.5 font-bold outline-none"
            >
              <option value="SUPER_ADMIN">Admin</option>
              <option value="MAIN_GATE">Main Gate</option>
              <option value="MILL_WEIGHTMENT">Mill WB</option>
              <option value="ELECTRIC_WEIGHTMENT">Electric WB</option>
              <option value="STORE_DEPT">Store Dept</option>
            </select>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="p-2 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            title="Exit Session"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ==========================================
          2. SECONDARY SUB-NAVIGATION BAR
         ========================================== */}
      <div className="bg-[#EAE2D2] border border-[#C5BA9E] px-4 sm:px-6 py-1.5 flex items-center justify-between shrink-0 text-xs overflow-x-auto scrollbar-none gap-4 rounded-xl">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setActiveTab("operations")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg font-extrabold uppercase text-[11px] tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "operations"
                ? "bg-[#1E331B] text-[#FAF7F0] shadow-md"
                : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#FAF7F0]"
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Station Operations</span>
          </button>

          {currentUserRole === "SUPER_ADMIN" && (
            <>
              <button
                onClick={() => setActiveTab("settings")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg font-extrabold uppercase text-[11px] tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "settings"
                    ? "bg-[#1E331B] text-[#FAF7F0] shadow-md"
                    : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#FAF7F0]"
                )}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>System Config</span>
              </button>

              <button
                onClick={() => setActiveTab("masters")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg font-extrabold uppercase text-[11px] tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "masters"
                    ? "bg-[#1E331B] text-[#FAF7F0] shadow-md"
                    : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#FAF7F0]"
                )}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Master Data</span>
              </button>

              <button
                onClick={() => setActiveTab("users")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg font-extrabold uppercase text-[11px] tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "users"
                    ? "bg-[#1E331B] text-[#FAF7F0] shadow-md"
                    : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#FAF7F0]"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff Users</span>
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg font-extrabold uppercase text-[11px] tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "audit"
                    ? "bg-[#1E331B] text-[#FAF7F0] shadow-md"
                    : "text-[#5A6E54] hover:text-[#1E331B] hover:bg-[#FAF7F0]"
                )}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Audit Logs</span>
              </button>
            </>
          )}
        </div>

        {/* Global Export & PDF Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generateShiftLedgerPdf}
            className="px-2.5 py-1 bg-[#FAF7F0] hover:bg-[#D6CAA8] border border-[#C5BA9E] rounded-lg text-[#1E331B] font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#1E331B]" />
            <span className="hidden sm:inline">Shift PDF</span>
          </button>

          <button
            onClick={exportCsvLog}
            className="px-2.5 py-1 bg-[#FAF7F0] hover:bg-[#D6CAA8] border border-[#C5BA9E] rounded-lg text-[#1E331B] font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* ==========================================
          3. MAIN VIEW CONTENT AREA
         ========================================== */}
      <main className="flex-1 p-3 sm:p-6 space-y-6 max-w-full overflow-x-hidden">

        {/* ==========================================
            TAB 1: OPERATIONAL STATIONS (ROLE-BASED)
           ========================================== */}
        {activeTab === "operations" && (
          <div className="space-y-6">

            {/* A. SUPER ADMIN DASHBOARD SUMMARY GRID */}
            {currentUserRole === "SUPER_ADMIN" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</span>
                    <Truck className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-2 font-mono">{lorries.length}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Active & completed lorry entries</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">In-Yard Pending</span>
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
                    {lorries.filter((l) => l.status !== "COMPLETED").length}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Awaiting weighment / unloading</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ready for Exit</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
                    {lorries.filter((l) => l.status === "READY_FOR_GATE_EXIT").length}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Cleared for Main Gate Exit</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Geofence Status</span>
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="text-sm font-bold text-white mt-2 font-mono flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", settings.enforceGeofence ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
                    {settings.enforceGeofence ? "ENFORCED (500m)" : "DISABLED"}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Bally Jute Mill coordinates</p>
                </div>
              </div>
            )}

            {/* B. MAIN GATE INTERFACE */}
            {(currentUserRole === "MAIN_GATE" || currentUserRole === "SUPER_ADMIN") && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Gate Entry Form */}
                <div className="lg:col-span-5 bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                    <Truck className="w-5 h-5 text-blue-400" />
                    <div>
                      <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                        Main Gate Lorry Entry Registration
                      </h2>
                      <p className="text-[11px] text-slate-400">Generates unique Gate Pass & logs entry timestamp</p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = {
                        lorryNo: (form.elements.namedItem("lorryNo") as HTMLInputElement).value,
                        driverPhone: (form.elements.namedItem("driverPhone") as HTMLInputElement).value,
                        department: (form.elements.namedItem("department") as HTMLSelectElement).value as DepartmentType,
                        broker: (form.elements.namedItem("broker") as HTMLSelectElement).value,
                        quality: (form.elements.namedItem("quality") as HTMLSelectElement).value,
                        mokam: (form.elements.namedItem("mokam") as HTMLSelectElement).value,
                        marka: (form.elements.namedItem("marka") as HTMLSelectElement).value,
                      };
                      handleRegisterGateEntry(formData);
                      form.reset();
                    }}
                    className="space-y-3.5"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Lorry Registration No *
                      </label>
                      <input
                        required
                        name="lorryNo"
                        type="text"
                        placeholder="e.g. WB-04-E-1234"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Driver Phone No *
                        </label>
                        <input
                          required
                          name="driverPhone"
                          type="text"
                          placeholder="+91 98300 00000"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Designated Dept *
                        </label>
                        <select
                          name="department"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-blue-500"
                        >
                          <option value="Jute">Jute Raw Material</option>
                          <option value="Store">Store Spares</option>
                          <option value="Finish Good">Finish Good Dispatch</option>
                          <option value="Other">Other Material</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Broker / Supplier *
                        </label>
                        <select
                          name="broker"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        >
                          {masters.brokers.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Quality / Grade *
                        </label>
                        <select
                          name="quality"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        >
                          {masters.qualities.map((q) => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Mokam / Origin
                        </label>
                        <select
                          name="mokam"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        >
                          {masters.mokams.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Marka
                        </label>
                        <select
                          name="marka"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                        >
                          {masters.markas.map((mk) => (
                            <option key={mk} value={mk}>{mk}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-extrabold text-xs uppercase tracking-wider text-white rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register Gate Pass & Print Entry Tag</span>
                    </button>
                  </form>
                </div>

                {/* Gate Out & Pending Exit Queue */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                          Ready For Gate Out Exit
                        </h2>
                        <p className="text-[11px] text-slate-400">Lorries cleared by Mill/Electric weighments or departments</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-full">
                      {lorries.filter((l) => l.status === "READY_FOR_GATE_EXIT").length} Ready
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {lorries.filter((l) => l.status === "READY_FOR_GATE_EXIT").length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs font-mono">
                        No lorries currently awaiting gate exit clearance.
                      </div>
                    ) : (
                      lorries
                        .filter((l) => l.status === "READY_FOR_GATE_EXIT")
                        .map((l) => (
                          <div
                            key={l.id}
                            className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/60 transition-all"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-white font-mono">{l.lorryNo}</span>
                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 text-[10px] font-mono rounded">
                                  {l.gatePassNo}
                                </span>
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase rounded">
                                  {l.department}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                Broker: <strong>{l.broker}</strong> | Quality: <strong>{l.quality}</strong>
                              </p>
                              {l.finalNetWeight && (
                                <p className="text-xs text-emerald-400 font-mono font-bold">
                                  Final Net Dispatch: {l.finalNetWeight.toLocaleString()} KG
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleGateOutExit(l)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Complete Gate Out & Print Slip</span>
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* C. WEIGHMENT INTERFACES (MILL & ELECTRIC WEIGHBRIDGE) */}
            {(currentUserRole === "MILL_WEIGHTMENT" ||
              currentUserRole === "ELECTRIC_WEIGHTMENT" ||
              currentUserRole === "SUPER_ADMIN") && (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
                  <div className="flex items-center gap-3">
                    <Scale className="w-6 h-6 text-amber-400 shrink-0" />
                    <div>
                      <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
                        {currentUserRole === "ELECTRIC_WEIGHTMENT" ? "Electric Scale Weighbridge Station" : "Mill Yard Scale Weighbridge Station"}
                      </h2>
                      <p className="text-xs text-slate-400">
                        Zero Offset Applied: <strong className="text-amber-300 font-mono">
                          {currentUserRole === "ELECTRIC_WEIGHTMENT" ? settings.electricZeroOffsetKg : settings.millZeroOffsetKg} KG
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold rounded-full">
                      Live Industrial Scale Connected
                    </span>
                  </div>
                </div>

                {/* Queue of Lorries Pending Weighment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lorries
                    .filter((l) => {
                      if (l.department !== "Jute") return false;
                      if (currentUserRole === "MILL_WEIGHTMENT") {
                        return l.status === "WAITING_FOR_MILL_GROSS" || l.status === "MILL_TARE_PENDING";
                      }
                      if (currentUserRole === "ELECTRIC_WEIGHTMENT") {
                        return l.status === "ELECTRIC_GROSS_PENDING" || l.status === "ELECTRIC_TARE_PENDING";
                      }
                      return l.status !== "COMPLETED";
                    })
                    .map((l) => (
                      <WeighmentOperatorCard
                        key={l.id}
                        lorry={l}
                        currentUserRole={currentUserRole}
                        settings={settings}
                        onSaveWeighment={handleSaveWeighment}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* D. STORE / FINISH GOOD / OTHER DEPARTMENTS INTERFACE */}
            {(currentUserRole === "STORE_DEPT" || currentUserRole === "SUPER_ADMIN") && (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <PackageCheck className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                        Store & Material Department Clearance
                      </h2>
                      <p className="text-[11px] text-slate-400">Verify material unloading & sign-off for gate release</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {lorries.filter((l) => ["STORE_PENDING", "FINISH_GOOD_PENDING", "OTHER_PENDING"].includes(l.status)).length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs font-mono">
                      No store or department lorries currently pending verification.
                    </div>
                  ) : (
                    lorries
                      .filter((l) => ["STORE_PENDING", "FINISH_GOOD_PENDING", "OTHER_PENDING"].includes(l.status))
                      .map((l) => (
                        <div
                          key={l.id}
                          className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white font-mono">{l.lorryNo}</span>
                              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 text-xs font-mono rounded">{l.gatePassNo}</span>
                              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase rounded">{l.department}</span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Broker: <strong>{l.broker}</strong> | Quality: <strong>{l.quality}</strong>
                            </p>
                            <p className="text-[11px] text-slate-500">In Time: {new Date(l.inTime).toLocaleString("en-IN")}</p>
                          </div>

                          <button
                            onClick={() => handleDepartmentApprove(l.id)}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                          >
                            <Check className="w-4 h-4" />
                            <span>Verify Unloading & Approve Gate Exit</span>
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* E. ALL DISPATCHES MASTER TABLE (WITH FILTERS & SEARCH) */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                    All Dispatch Ledger Register ({filteredLorries.length})
                  </h2>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search lorry, gate pass, broker..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-xs text-white pl-8 pr-3 py-1.5 rounded-xl outline-none focus:border-blue-500 w-48 sm:w-64 font-mono"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs text-slate-300 px-2.5 py-1.5 rounded-xl outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="WAITING_FOR_MILL_GROSS">Waiting Mill Gross</option>
                    <option value="ELECTRIC_GROSS_PENDING">Pending Elec Gross</option>
                    <option value="MILL_TARE_PENDING">Pending Mill Tare</option>
                    <option value="ELECTRIC_TARE_PENDING">Pending Elec Tare</option>
                    <option value="READY_FOR_GATE_EXIT">Ready Exit</option>
                    <option value="COMPLETED">Completed</option>
                  </select>

                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs text-slate-300 px-2.5 py-1.5 rounded-xl outline-none"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="Jute">Jute</option>
                    <option value="Store">Store</option>
                    <option value="Finish Good">Finish Good</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="w-full overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300 min-w-[900px]">
                  <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-3">Gate Pass</th>
                      <th className="p-3">Lorry No</th>
                      <th className="p-3">Dept</th>
                      <th className="p-3">Broker / Supplier</th>
                      <th className="p-3">Quality</th>
                      <th className="p-3 text-right">Mill Net</th>
                      <th className="p-3 text-right">Elec Net</th>
                      <th className="p-3 text-right">Final Net</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredLorries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">
                          No matching dispatch entries found in ledger.
                        </td>
                      </tr>
                    ) : (
                      filteredLorries.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 font-bold text-blue-400">{l.gatePassNo}</td>
                          <td className="p-3 font-bold text-white">{l.lorryNo}</td>
                          <td className="p-3">{l.department}</td>
                          <td className="p-3 font-sans">{l.broker}</td>
                          <td className="p-3 font-sans">{l.quality}</td>
                          <td className="p-3 text-right font-bold text-slate-200">
                            {l.millNetWeight ? `${l.millNetWeight.toLocaleString()} kg` : "-"}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-200">
                            {l.electricNetWeight ? `${l.electricNetWeight.toLocaleString()} kg` : "-"}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-400">
                            {l.finalNetWeight ? `${l.finalNetWeight.toLocaleString()} kg` : "-"}
                          </td>
                          <td className="p-3">
                            <span
                              className={cn(
                                "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border",
                                l.status === "COMPLETED"
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : l.status === "READY_FOR_GATE_EXIT"
                                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              )}
                            >
                              {l.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedLorryForReceipt(l);
                                setIsReceiptModalOpen(true);
                              }}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700 rounded text-[10px] font-bold cursor-pointer"
                              title="View & Print Slip"
                            >
                              Slip
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            TAB 2: SUPER ADMIN CONFIGURATION SETTINGS
           ========================================== */}
        {activeTab === "settings" && currentUserRole === "SUPER_ADMIN" && (
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <Sliders className="w-6 h-6 text-blue-400" />
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
                  System Configuration Panel
                </h2>
                <p className="text-xs text-slate-400">Adjust zero offsets, geofence parameters, and auto-logout rules</p>
              </div>
            </div>

            <div className="space-y-5 text-xs">
              {/* Zero Offsets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">
                    Mill Zero Offset Adjustment (KG): {settings.millZeroOffsetKg} kg
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={settings.millZeroOffsetKg}
                    onChange={(e) =>
                      setSettings({ ...settings, millZeroOffsetKg: Number(e.target.value) })
                    }
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">
                    Electric Zero Offset Adjustment (KG): {settings.electricZeroOffsetKg} kg
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={settings.electricZeroOffsetKg}
                    onChange={(e) =>
                      setSettings({ ...settings, electricZeroOffsetKg: Number(e.target.value) })
                    }
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              {/* Geofence Settings */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white uppercase">Enforce Geofencing Boundary</h3>
                    <p className="text-[11px] text-slate-400">Restrict weighment submission to Bally Jute Mill campus</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enforceGeofence}
                    onChange={(e) =>
                      setSettings({ ...settings, enforceGeofence: e.target.checked })
                    }
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">
                    Allowed Geofence Radius (Meters): {settings.geofenceRadiusMeters} meters
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={settings.geofenceRadiusMeters}
                    onChange={(e) =>
                      setSettings({ ...settings, geofenceRadiusMeters: Number(e.target.value) })
                    }
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              {/* Inactivity & Security Controls */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <label className="font-bold text-slate-300 uppercase block mb-1">
                    Inactivity Auto-Logout Timeout (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.inactivityTimeoutMinutes}
                    onChange={(e) =>
                      setSettings({ ...settings, inactivityTimeoutMinutes: Number(e.target.value) })
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono text-xs w-32 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <h3 className="font-bold text-white uppercase">Allow Screen Capture & Screenshots</h3>
                    <p className="text-[11px] text-slate-400">When OFF, blurs screen upon focus loss to protect sensitive data</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowScreenCapture}
                    onChange={(e) =>
                      setSettings({ ...settings, allowScreenCapture: e.target.checked })
                    }
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  logAuditAction("SETTINGS_UPDATED", "Super Admin updated system parameters");
                  alert("System parameters updated successfully!");
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Save Configuration Settings
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 3: MASTER DATA MANAGER
           ========================================== */}
        {activeTab === "masters" && currentUserRole === "SUPER_ADMIN" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Manage Brokers */}
            <MasterListEditor
              title="Brokers / Suppliers"
              items={masters.brokers}
              onAdd={(newItem) => setMasters({ ...masters, brokers: [...masters.brokers, newItem] })}
              onDelete={(item) => setMasters({ ...masters, brokers: masters.brokers.filter((b) => b !== item) })}
            />

            {/* Manage Qualities */}
            <MasterListEditor
              title="Raw Jute Qualities & Grades"
              items={masters.qualities}
              onAdd={(newItem) => setMasters({ ...masters, qualities: [...masters.qualities, newItem] })}
              onDelete={(item) => setMasters({ ...masters, qualities: masters.qualities.filter((q) => q !== item) })}
            />

            {/* Manage Mokams */}
            <MasterListEditor
              title="Mokams / Origin Depots"
              items={masters.mokams}
              onAdd={(newItem) => setMasters({ ...masters, mokams: [...masters.mokams, newItem] })}
              onDelete={(item) => setMasters({ ...masters, mokams: masters.mokams.filter((m) => m !== item) })}
            />

            {/* Manage Markas */}
            <MasterListEditor
              title="Jute Bale Markas"
              items={masters.markas}
              onAdd={(newItem) => setMasters({ ...masters, markas: [...masters.markas, newItem] })}
              onDelete={(item) => setMasters({ ...masters, markas: masters.markas.filter((mk) => mk !== item) })}
            />
          </div>
        )}

        {/* ==========================================
            TAB 4: STAFF USERS MANAGEMENT
           ========================================== */}
        {activeTab === "users" && currentUserRole === "SUPER_ADMIN" && (
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  Station Operator Login Accounts
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((u) => (
                <div key={u.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white font-mono">{u.username}</span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 text-[10px] font-bold rounded uppercase">
                      {u.role.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{u.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Last active: {u.lastActive}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: AUDIT LOGS
           ========================================== */}
        {activeTab === "audit" && currentUserRole === "SUPER_ADMIN" && (
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  System Audit Log Trail ({auditLogs.length})
                </h2>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Station / User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50">
                      <td className="p-3 text-slate-500">{new Date(log.timestamp).toLocaleString("en-IN")}</td>
                      <td className="p-3 font-bold text-blue-400">{log.role} ({log.username})</td>
                      <td className="p-3 font-bold text-emerald-400">{log.action}</td>
                      <td className="p-3 text-slate-300">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* ==========================================
          4. REAL-TIME ALERT DRAWER (SLIDE-OUT)
         ========================================== */}
      {isAlertDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  Station Dispatch Alerts
                </h3>
              </div>
              <button
                onClick={() => setIsAlertDrawerOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {alerts.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">No active alerts.</div>
              ) : (
                alerts.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "p-3 rounded-xl border space-y-1 transition-all",
                      a.type === "success"
                        ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        : a.type === "alert"
                        ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                        : "bg-blue-950/30 border-blue-500/30 text-blue-300"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-bold font-mono">
                      <span>{a.title}</span>
                      <span className="text-[10px] opacity-70">
                        {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{a.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          5. GEOFENCE GPS SIMULATOR MODAL
         ========================================== */}
      {isGpsSimOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-lg p-5 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  GPS Location Simulator (Development)
                </h3>
              </div>
              <button onClick={() => setIsGpsSimOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Mock operator device location to test Bally Jute Mill geofence boundary enforcement ({settings.geofenceRadiusMeters}m radius).
            </p>

            <div className="space-y-2">
              {[
                { label: "Inside Jute Mill Yard (0m)", lat: 22.6500, lng: 88.3400 },
                { label: "Gate Entrance (120m)", lat: 22.6510, lng: 88.3408 },
                { label: "Weighbridge Bay (210m)", lat: 22.6488, lng: 88.3392 },
                { label: "Outside Mill Area (2500m)", lat: 22.6700, lng: 88.3600 },
              ].map((loc) => (
                <button
                  key={loc.label}
                  onClick={() => {
                    setUserGps({ lat: loc.lat, lng: loc.lng, label: loc.label });
                    setIsGpsSimOpen(false);
                    logAuditAction("GPS_SIMULATED", `GPS position set to ${loc.label}`);
                  }}
                  className="w-full text-left p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>{loc.label}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {loc.lat}, {loc.lng}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          6. 3-INCH RECEIPT MODAL & PRINT PREVIEW
         ========================================== */}
      {isReceiptModalOpen && selectedLorryForReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-sm p-5 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                3-Inch Thermal Receipt Preview
              </h3>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printed Ticket Card */}
            <div className="bg-white text-slate-900 p-4 rounded-xl text-xs font-mono space-y-2 border border-slate-300 shadow-inner">
              <div className="text-center border-b border-slate-300 pb-2">
                <p className="font-black text-sm uppercase">BALLY JUTE LIMITED</p>
                <p className="text-[9px]">Lorry Weighment & Dispatch Slip</p>
              </div>

              <div className="space-y-1 text-[11px]">
                <p><strong>Gate Pass:</strong> {selectedLorryForReceipt.gatePassNo}</p>
                <p><strong>Lorry No:</strong> {selectedLorryForReceipt.lorryNo}</p>
                <p><strong>Broker:</strong> {selectedLorryForReceipt.broker}</p>
                <p><strong>Quality:</strong> {selectedLorryForReceipt.quality}</p>
                <p><strong>Dept:</strong> {selectedLorryForReceipt.department}</p>
                <p><strong>In Time:</strong> {new Date(selectedLorryForReceipt.inTime).toLocaleString("en-IN")}</p>
              </div>

              <div className="border-t border-slate-300 pt-2 space-y-1 text-[11px]">
                {selectedLorryForReceipt.millGrossWeight && <p>Mill Gross: {selectedLorryForReceipt.millGrossWeight.toLocaleString()} kg</p>}
                {selectedLorryForReceipt.millTareWeight && <p>Mill Tare: {selectedLorryForReceipt.millTareWeight.toLocaleString()} kg</p>}
                {selectedLorryForReceipt.electricGrossWeight && <p>Elec Gross: {selectedLorryForReceipt.electricGrossWeight.toLocaleString()} kg</p>}
                {selectedLorryForReceipt.electricTareWeight && <p>Elec Tare: {selectedLorryForReceipt.electricTareWeight.toLocaleString()} kg</p>}
                <p className="font-bold text-sm text-slate-950 pt-1 border-t border-slate-400">
                  FINAL NET: {(selectedLorryForReceipt.finalNetWeight || 0).toLocaleString()} KG
                </p>
              </div>
            </div>

            <button
              onClick={() => generateReceiptSlipPdf(selectedLorryForReceipt)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              <span>Download / Print 3-Inch Slip PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-xs p-5 rounded-2xl shadow-2xl space-y-4 text-center">
            <LogOut className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
              Confirm Station Exit?
            </h3>
            <p className="text-xs text-slate-400">Are you sure you want to end your current operator session?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2 bg-slate-900 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  setCurrentUserRole("MAIN_GATE");
                  logAuditAction("MANUAL_LOGOUT", "Operator exited active session");
                }}
                className="flex-1 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </LegacyLayout>
  );
}

// ==========================================
// SUB-COMPONENT: WEIGHMENT OPERATOR CARD
// ==========================================

function WeighmentOperatorCard({
  lorry,
  currentUserRole,
  settings,
  onSaveWeighment,
}: {
  lorry: LorryRecord;
  currentUserRole: UserRole;
  settings: SystemSettings;
  onSaveWeighment: (
    lorryId: string,
    station: "MILL" | "ELECTRIC",
    type: "GROSS" | "TARE",
    weightKg: number
  ) => void;
}) {
  const isMill = currentUserRole === "MILL_WEIGHTMENT" || currentUserRole === "SUPER_ADMIN";
  const isElectric = currentUserRole === "ELECTRIC_WEIGHTMENT";

  const station = isElectric ? "ELECTRIC" : "MILL";
  const isTareStep =
    lorry.status === "MILL_TARE_PENDING" || lorry.status === "ELECTRIC_TARE_PENDING";
  const type = isTareStep ? "TARE" : "GROSS";

  const zeroOffset = isElectric ? settings.electricZeroOffsetKg : settings.millZeroOffsetKg;

  const [simulatedWeight, setSimulatedWeight] = useState<number>(
    isTareStep ? 14200 : 38500
  );

  const displayWeight = simulatedWeight + zeroOffset;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 hover:border-amber-500/40 transition-all">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div>
          <span className="text-sm font-black text-white font-mono">{lorry.lorryNo}</span>
          <p className="text-[10px] text-slate-400 font-mono">{lorry.gatePassNo} • {lorry.broker}</p>
        </div>
        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold rounded-full uppercase">
          {type} WEIGHMENT PENDING
        </span>
      </div>

      {/* Large Industrial LED Digital Weight Display */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center space-y-1 shadow-inner">
        <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">
          LIVE SCALE SIMULATED WEIGHT (KG)
        </span>
        <div className="text-3xl font-black font-mono text-emerald-400 tracking-widest drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
          {displayWeight.toLocaleString()} <span className="text-sm font-bold text-emerald-600">KG</span>
        </div>
      </div>

      {/* Quick Weight Adjuster Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSimulatedWeight((prev) => Math.max(0, prev - 100))}
          className="flex-1 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 text-xs font-mono font-bold cursor-pointer"
        >
          -100 KG
        </button>
        <button
          onClick={() => setSimulatedWeight((prev) => prev + 100)}
          className="flex-1 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 text-xs font-mono font-bold cursor-pointer"
        >
          +100 KG
        </button>
      </div>

      <button
        onClick={() => onSaveWeighment(lorry.id, station, type, displayWeight)}
        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <Scale className="w-4 h-4" />
        <span>Save & Confirm {station} {type} ({displayWeight.toLocaleString()} KG)</span>
      </button>
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: MASTER DATA LIST EDITOR
// ==========================================

function MasterListEditor({
  title,
  items,
  onAdd,
  onDelete,
}: {
  title: string;
  items: string[];
  onAdd: (newItem: string) => void;
  onDelete: (item: string) => void;
}) {
  const [inputVal, setInputVal] = useState("");

  return (
    <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
      <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
        {title} ({items.length})
      </h3>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={`Add new ${title.toLowerCase()}...`}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
        />
        <button
          onClick={() => {
            if (inputVal.trim()) {
              onAdd(inputVal.trim());
              setInputVal("");
            }
          }}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase rounded-xl cursor-pointer"
        >
          Add
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {items.map((it) => (
          <div
            key={it}
            className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl flex items-center justify-between text-xs text-slate-200"
          >
            <span>{it}</span>
            <button
              onClick={() => onDelete(it)}
              className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
