export interface UserContext {
  userId?: string;
  userName?: string;
  username?: string;
  userRole?: string;
  userLevel?: string;
  allowedModules?: string[];
  permissions?: string[];
  [key: string]: any;
}

export interface SystemModuleDef {
  id: string;
  label: string;
  category: string;
  pageId: string;
  aliases: string[];
  description?: string;
}

// Master Directory of every independent Module ID in the application
export const ALL_SYSTEM_MODULES: SystemModuleDef[] = [
  // 1. Overview
  {
    id: 'dashboard',
    label: 'Dashboard (Operational Hub)',
    category: 'Overview',
    pageId: 'dashboard',
    aliases: ['dashboard', 'operational_hub', 'hub', 'home', 'operational hub', 'operationalhub']
  },

  // 2. Gate Operations
  {
    id: 'main_gate',
    label: 'Main Gate',
    category: 'Gate Operations',
    pageId: 'main_gate',
    aliases: ['main_gate', 'maingate', 'main gate', 'gate_module', 'gate module', 'lorry_entry', 'lorry entry', 'dispatch']
  },

  // 3. Sauda & Procurement
  {
    id: 'sms_sauda',
    label: 'SMS Sauda Desk',
    category: 'Sauda & Procurement',
    pageId: 'sms_sauda',
    aliases: ['sms_sauda', 'sms', 'sms_desk', 'sms desk', 'sms_interfaces', 'sms sauda', 'smssauda', 'sms sauda desk', 'smssaudadesk', 'sms_contracts']
  },
  {
    id: 'sauda',
    label: 'Sauda Desk',
    category: 'Sauda & Procurement',
    pageId: 'sauda',
    aliases: ['sauda', 'sauda_desk', 'sauda desk', 'saudadesk', 'sauda_entry', 'sauda entry', 'saudaentry', 'sauda_master', 'sauda master', 'saudamaster', 'sauda_bookings', 'sauda bookings', 'sauda_module', 'sauda module', 'sauda_contracts']
  },
  {
    id: 'satta',
    label: 'Satta Desk',
    category: 'Sauda & Procurement',
    pageId: 'satta',
    aliases: ['satta', 'satta_desk', 'satta desk', 'sattadesk', 'satta_entry', 'satta entry', 'sattaentry', 'satta_master']
  },
  {
    id: 'satta_chart',
    label: 'Satta Rate Chart',
    category: 'Sauda & Procurement',
    pageId: 'satta_chart',
    aliases: ['satta_chart', 'satta chart', 'sattachart', 'rate_chart', 'rate chart', 'ratechart', 'satta_rates', 'satta rates', 'sattarates', 'satta_rate_chart']
  },
  {
    id: 'po',
    label: 'Sauda Check Point',
    category: 'Sauda & Procurement',
    pageId: 'po',
    aliases: ['po', 'sauda_check', 'sauda check', 'saudacheck', 'sauda_check_point', 'sauda check point', 'saudacheckpoint', 'sauda_po_check', 'purchase_order', 'purchase order', 'temp_po', 'po_temp', 'temp po']
  },
  {
    id: 'final_po',
    label: 'Final P.O',
    category: 'Sauda & Procurement',
    pageId: 'final_po',
    aliases: ['final_po', 'final po', 'finalpo', 'final_purchase_order', 'final purchase order', 'po_final', 'po final', 'pofinal']
  },

  // 4. Arrival & Inspection
  {
    id: 'amad',
    label: 'Temporary Arrival',
    category: 'Arrival & Inspection',
    pageId: 'amad',
    aliases: ['amad', 'amad_entry', 'amad entry', 'tmr', 'temporary_arrival', 'temporary arrival', 'temporary_mr', 'temporary mr', 'temp arrival']
  },
  {
    id: 'final_arrival',
    label: 'Final Arrival',
    category: 'Arrival & Inspection',
    pageId: 'final_arrival',
    aliases: ['final_arrival', 'final arrival', 'finalarrival', 'final_mr', 'final mr', 'finalmr', 'final_arrival_entry']
  },
  {
    id: 'inspection',
    label: 'Mill Inspection',
    category: 'Arrival & Inspection',
    pageId: 'inspection',
    aliases: ['inspection', 'mill_inspection', 'mill inspection', 'millinspection', 'mill_inspection_master', 'final_mr_inspection']
  },
  {
    id: 'material_inspection',
    label: 'Inspection Checklist',
    category: 'Arrival & Inspection',
    pageId: 'material_inspection',
    aliases: ['material_inspection', 'material inspection', 'materialinspection', 'inspection_checklist', 'inspection checklist', 'quality_inspection', 'quality inspection']
  },
  {
    id: 'mismatch',
    label: 'Satta Mismatch Case',
    category: 'Arrival & Inspection',
    pageId: 'mismatch',
    aliases: ['mismatch', 'satta_mismatch', 'satta mismatch', 'mismatch_case', 'mismatch case']
  },
  {
    id: 'material_mismatch',
    label: 'Material Mismatch Case',
    category: 'Arrival & Inspection',
    pageId: 'material_mismatch',
    aliases: ['material_mismatch', 'material mismatch', 'materialmismatch', 'mat_mismatch']
  },

  // 5. Club & Financial
  {
    id: 'club_po_mr',
    label: 'Club P.O & Arrival',
    category: 'Club & Financial',
    pageId: 'club_po_mr',
    aliases: ['club_po_mr', 'club po mr', 'club_po', 'club po', 'club_mr', 'club mr', 'club']
  },
  {
    id: 'payment',
    label: 'Payment Module',
    category: 'Club & Financial',
    pageId: 'payment',
    aliases: ['payment', 'payment_module', 'payment module', 'payments']
  },
  {
    id: 'mr_settlement',
    label: 'Settlement',
    category: 'Club & Financial',
    pageId: 'mr_settlement',
    aliases: ['mr_settlement', 'mr settlement', 'settlement', 'mr_claim', 'claim_settlement']
  },

  // 6. Inventory & Issue
  {
    id: 'issue',
    label: 'Material Issue',
    category: 'Inventory & Issue',
    pageId: 'issue',
    aliases: ['issue', 'material_issue', 'material issue', 'material_issue_entry']
  },
  {
    id: 'closing_stock',
    label: 'Stock Inventory',
    category: 'Inventory & Issue',
    pageId: 'closing_stock',
    aliases: ['closing_stock', 'closing stock', 'stock_inventory', 'stock inventory', 'stock', 'inventory']
  },
  {
    id: 'requisition_desk',
    label: 'Requisition Desk',
    category: 'Inventory & Issue',
    pageId: 'requisition_desk',
    aliases: ['requisition_desk', 'requisition desk', 'requisition', 'req_desk']
  },
  {
    id: 'bardana',
    label: 'Godown Master',
    category: 'Inventory & Issue',
    pageId: 'bardana',
    aliases: ['bardana', 'godown_master', 'godown master', 'godown']
  },
  {
    id: 'weight_bridge',
    label: 'Weight Bridge',
    category: 'Inventory & Issue',
    pageId: 'weight_bridge',
    aliases: ['weight_bridge', 'weight bridge', 'weigh_bridge', 'weighbridge', 'wb_view_dashboard', 'wb_stage1_create', 'wb_stage2_create', 'wb_stage3_create', 'wb_view_final']
  },

  // 7. Reports & Administration
  {
    id: 'reports',
    label: 'System Reports',
    category: 'Reports & Administration',
    pageId: 'reports',
    aliases: ['reports', 'system_reports', 'system reports', 'analytical_reports']
  },
  {
    id: 'vyapari',
    label: 'Traders Directory',
    category: 'Reports & Administration',
    pageId: 'vyapari',
    aliases: ['vyapari', 'traders_directory', 'traders directory', 'trader_directory']
  },
  {
    id: 'admindesk',
    label: 'Admin Desk',
    category: 'Reports & Administration',
    pageId: 'admindesk',
    aliases: ['admindesk', 'admin_desk', 'admin desk', 'admin_vault', 'admin']
  },
  {
    id: 'settings',
    label: 'Config Center / Settings',
    category: 'Reports & Administration',
    pageId: 'settings',
    aliases: ['settings', 'config_center', 'config center', 'config_guide']
  },
  {
    id: 'ai_assistant',
    label: 'Jarves AI 2.0',
    category: 'Reports & Administration',
    pageId: 'ai_assistant',
    aliases: ['ai_assistant', 'ai assistant', 'jarves_ai', 'jarves ai', 'ai_portal', 'jarves']
  },
];

// Resolves any page name, route alias, label, or legacy ID to its exact primary Module ID
export function getCanonicalModuleId(idOrAlias: string): string {
  if (!idOrAlias) return '';
  const clean = String(idOrAlias).toLowerCase().trim();
  if (clean === '*' || clean === 'all') return '*';

  // 1. Direct ID / pageId match
  const directMatch = ALL_SYSTEM_MODULES.find(
    (m) => m.id.toLowerCase() === clean || m.pageId.toLowerCase() === clean
  );
  if (directMatch) return directMatch.id;

  // 2. Direct label match
  const labelMatch = ALL_SYSTEM_MODULES.find(
    (m) => m.label.toLowerCase() === clean
  );
  if (labelMatch) return labelMatch.id;

  // 3. Exact alias match
  const aliasMatch = ALL_SYSTEM_MODULES.find((m) =>
    m.aliases.some((a) => a.toLowerCase() === clean)
  );
  if (aliasMatch) return aliasMatch.id;

  // 4. Normalized alphanumeric match (stripping all spaces, dashes, dots, underscores)
  const alphaClean = clean.replace(/[^a-z0-9]/g, '');
  if (!alphaClean) return clean;

  const alphaMatch = ALL_SYSTEM_MODULES.find((m) => {
    if (m.id.replace(/[^a-z0-9]/g, '').toLowerCase() === alphaClean) return true;
    if (m.pageId.replace(/[^a-z0-9]/g, '').toLowerCase() === alphaClean) return true;
    if (m.label.replace(/[^a-z0-9]/g, '').toLowerCase() === alphaClean) return true;
    return m.aliases.some(
      (a) => a.replace(/[^a-z0-9]/g, '').toLowerCase() === alphaClean
    );
  });
  if (alphaMatch) return alphaMatch.id;

  // 5. Semantic keyword mapping for user-entered terms
  if (alphaClean.includes('smssauda') || alphaClean.includes('smsdesk')) return 'sms_sauda';
  if (alphaClean.includes('saudadesk') || alphaClean === 'sauda' || alphaClean === 'saudaentry') return 'sauda';
  if (alphaClean.includes('sattachart') || alphaClean.includes('sattarate')) return 'satta_chart';
  if (alphaClean.includes('satta')) return 'satta';
  if (alphaClean.includes('saudacheck') || alphaClean === 'po' || alphaClean === 'potemp') return 'po';
  if (alphaClean.includes('finalpo') || alphaClean === 'pofinal') return 'final_po';
  if (alphaClean.includes('maingate') || alphaClean.includes('lorryentry')) return 'main_gate';
  if (alphaClean.includes('finalarrival') || alphaClean.includes('finalmr')) return 'final_arrival';
  if (alphaClean.includes('materialinspection') || alphaClean.includes('inspectionchecklist')) return 'material_inspection';
  if (alphaClean.includes('inspection')) return 'inspection';
  if (alphaClean.includes('materialmismatch')) return 'material_mismatch';
  if (alphaClean.includes('mismatch')) return 'mismatch';
  if (alphaClean.includes('clubpo')) return 'club_po_mr';
  if (alphaClean.includes('payment')) return 'payment';
  if (alphaClean.includes('settlement')) return 'mr_settlement';
  if (alphaClean.includes('issue')) return 'issue';
  if (alphaClean.includes('closingstock') || alphaClean.includes('stockinventory') || alphaClean === 'stock' || alphaClean === 'inventory') return 'closing_stock';
  if (alphaClean.includes('requisition')) return 'requisition_desk';
  if (alphaClean.includes('bardana') || alphaClean.includes('godown')) return 'bardana';
  if (alphaClean.includes('weightbridge') || alphaClean.includes('weighbridge')) return 'weight_bridge';
  if (alphaClean.includes('report')) return 'reports';
  if (alphaClean.includes('vyapari') || alphaClean.includes('trader')) return 'vyapari';
  if (alphaClean.includes('admindesk') || alphaClean === 'admin') return 'admindesk';
  if (alphaClean.includes('setting') || alphaClean.includes('config')) return 'settings';
  if (alphaClean.includes('jarves') || alphaClean.includes('aiassistant')) return 'ai_assistant';

  return clean;
}

// Normalizes any allowed_modules input (string, comma-separated, array, or JSON) into a pristine canonical ID list
export function normalizeAllowedModules(modules: string[] | string | undefined | null): string[] {
  if (!modules) return [];
  if (modules === '*') return ['*'];

  const rawList: string[] = Array.isArray(modules)
    ? modules
    : String(modules).split(',');

  const normalized: string[] = [];
  for (const item of rawList) {
    if (!item) continue;
    const str = String(item).trim();
    if (!str) continue;
    if (str === '*') {
      return ['*'];
    }
    // Handle cases where comma-separated values exist inside array elements
    if (str.includes(',')) {
      str.split(',').forEach((sub) => {
        const c = getCanonicalModuleId(sub);
        if (c) normalized.push(c);
      });
    } else {
      const c = getCanonicalModuleId(str);
      if (c) normalized.push(c);
    }
  }

  return Array.from(new Set(normalized));
}

let currentUserContext: UserContext = {
  userId: 'default_operator',
  userName: 'Operator',
  username: 'Operator',
  userRole: 'ADMIN',
  userLevel: 'L5',
  allowedModules: ['*'],
  permissions: ['ALL', 'EDIT', 'DELETE', 'VIEW'],
};

// Listeners for live permission change notifications
type PermissionListener = (context: UserContext) => void;
const permissionListeners = new Set<PermissionListener>();

export function subscribeToPermissions(listener: PermissionListener): () => void {
  permissionListeners.add(listener);
  return () => {
    permissionListeners.delete(listener);
  };
}

let isNotifyingListeners = false;

export function setCurrentUserContext(context: Partial<UserContext> | null | undefined, notify: boolean = true): void {
  if (context) {
    const updatedUser = context.username || context.userName || currentUserContext.username || currentUserContext.userName;
    const normalizedMods = context.allowedModules !== undefined
      ? normalizeAllowedModules(context.allowedModules)
      : currentUserContext.allowedModules;

    currentUserContext = {
      ...currentUserContext,
      ...context,
      userName: updatedUser,
      username: updatedUser,
      allowedModules: normalizedMods,
    };
    
    // Save to localStorage for persistence
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('bally_user_context', JSON.stringify(currentUserContext));
      }
    } catch (e) {
      console.warn("Could not save user context to localStorage:", e);
    }

    // Notify all subscribers (safely without recursive loops)
    if (notify && !isNotifyingListeners) {
      isNotifyingListeners = true;
      try {
        permissionListeners.forEach((fn) => {
          try {
            fn(currentUserContext);
          } catch (err) {
            console.error("Error in permission listener:", err);
          }
        });
      } finally {
        isNotifyingListeners = false;
      }
    }
  }
}

export function getCurrentUserContext(): UserContext {
  if (typeof window !== 'undefined' && (!currentUserContext.allowedModules || currentUserContext.allowedModules.length === 0)) {
    try {
      const saved = window.localStorage.getItem('bally_user_context');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          currentUserContext = {
            ...currentUserContext,
            ...parsed,
            allowedModules: normalizeAllowedModules(parsed.allowedModules || parsed.allowed_modules || ['*']),
          };
        }
      }
    } catch {
      // Ignore fallback errors
    }
  }
  return currentUserContext;
}

export function isUserAdmin(roleOrContext?: string | UserContext): boolean {
  let role = '';
  let level = '';
  let allowed: string[] = [];

  if (typeof roleOrContext === 'string') {
    role = roleOrContext.toUpperCase();
  } else if (roleOrContext && typeof roleOrContext === 'object') {
    role = (roleOrContext.userRole || '').toUpperCase();
    level = (roleOrContext.userLevel || '').toUpperCase();
    allowed = normalizeAllowedModules(roleOrContext.allowedModules || (roleOrContext as any).allowed_modules || []);
  } else {
    const ctx = getCurrentUserContext();
    role = (ctx?.userRole || '').toUpperCase();
    level = (ctx?.userLevel || '').toUpperCase();
    allowed = normalizeAllowedModules(ctx?.allowedModules || []);
  }

  if (allowed.includes('*')) return true;
  return role === 'ADMIN' || role === 'ADMINISTRATOR' || level === 'ADMIN' || level === 'ADMINISTRATOR' || level === 'MAX';
}

export function isL5OrAdmin(): boolean {
  const ctx = getCurrentUserContext();
  const level = (ctx?.userLevel || '').toUpperCase();
  return isUserAdmin() || level === 'L5' || level === 'L4';
}

export function canEditOrDelete(recordOrUser?: any): boolean {
  const ctx = getCurrentUserContext();
  if (isUserAdmin() || isL5OrAdmin()) return true;
  if (ctx?.permissions?.includes('ALL') || ctx?.permissions?.includes('EDIT') || ctx?.permissions?.includes('DELETE')) {
    return true;
  }
  return true;
}

export function enforceEditOrDeletePermission(actionName: string = 'this action'): boolean {
  if (!canEditOrDelete()) {
    if (typeof window !== 'undefined' && window.alert) {
      alert(`Access Denied: Your Operator profile does not hold permissions for ${actionName}.`);
    }
    return false;
  }
  return true;
}

export function canViewCompletedData(): boolean {
  return true;
}

/**
 * Strict Independent Module Permission Checker (canAccess)
 * 
 * Rules:
 * 1. Admin or full access ('*') returns TRUE for all modules.
 * 2. Every Module ID is independent. Parent groups do NOT grant permissions.
 * 3. Exact matching: canAccess("sms_sauda") verifies sms_sauda; canAccess("sauda") verifies sauda.
 * 4. Aliases: "sauda_desk", "saudadesk", "Sauda Desk", "sauda" all resolve to "sauda".
 */
export function canAccess(
  targetModuleOrPage: string,
  allowedModulesOverride?: string[],
  isAdminOverride?: boolean
): boolean {
  if (!targetModuleOrPage) return false;

  const ctx = getCurrentUserContext();
  const isAdmin = isAdminOverride !== undefined ? isAdminOverride : isUserAdmin();
  if (isAdmin) return true;

  const rawAllowed = allowedModulesOverride !== undefined
    ? allowedModulesOverride
    : (ctx.allowedModules || []);

  const cleanAllowed = normalizeAllowedModules(rawAllowed);
  if (cleanAllowed.includes('*')) return true;

  const canonicalTarget = getCanonicalModuleId(targetModuleOrPage);
  return cleanAllowed.includes(canonicalTarget);
}

// Alias hasModulePermission to canAccess for seamless backwards compatibility
export const hasModulePermission = canAccess;

/**
 * Filter an array of navigation menus by user permissions.
 * 
 * Rules:
 * - Parent menus (e.g. "Sauda To P.O", "Temporary Arrival To Final Arrival", etc.) are navigation containers ONLY.
 * - If a menu has `subItems`, each subItem is checked independently via canAccess.
 * - If a parent menu has NO permitted subItems, the entire parent menu is HIDDEN.
 * - If a parent menu has permitted subItems, ONLY the permitted subItems are shown.
 * - Leaf menus (e.g. Dashboard) are checked via canAccess.
 */
export function filterMenuByPermissions<T extends { id: string; pageId?: string; subItems?: any[] }>(
  menus: T[],
  allowedModulesOverride?: string[],
  isAdminOverride?: boolean
): T[] {
  const result: T[] = [];

  for (const menu of menus) {
    if (menu.subItems && menu.subItems.length > 0) {
      // Filter child subItems strictly
      const permittedSubItems = menu.subItems.filter((sub) => {
        const checkId = sub.pageId || sub.id;
        return canAccess(checkId, allowedModulesOverride, isAdminOverride);
      });

      // A parent menu appears ONLY when at least one child module inside that group is assigned
      if (permittedSubItems.length > 0) {
        result.push({
          ...menu,
          subItems: permittedSubItems,
        });
      }
    } else {
      // Leaf menu (e.g. dashboard)
      const checkId = menu.pageId || menu.id;
      if (canAccess(checkId, allowedModulesOverride, isAdminOverride)) {
        result.push(menu);
      }
    }
  }

  return result;
}

/**
 * Determine the default/first landing page for a user based on their allowed modules.
 */
export function getFirstAllowedPage(
  allowedModulesOverride?: string[],
  isAdminOverride?: boolean
): string {
  const isAdmin = isAdminOverride !== undefined ? isAdminOverride : isUserAdmin();
  if (isAdmin) return 'dashboard';

  const ctx = getCurrentUserContext();
  const allowedList = allowedModulesOverride !== undefined
    ? allowedModulesOverride
    : (ctx.allowedModules || []);

  if (allowedList.includes('*')) return 'dashboard';
  if (canAccess('dashboard', allowedList, false)) return 'dashboard';

  // Find the first registered module that is permitted
  for (const mod of ALL_SYSTEM_MODULES) {
    if (canAccess(mod.id, allowedList, false)) {
      return mod.pageId;
    }
  }

  // If nothing matched, check if any string in allowedList matches a module
  if (allowedList.length > 0) {
    const first = allowedList[0].trim();
    if (first && first !== '*') {
      const canonical = getCanonicalModuleId(first);
      const found = ALL_SYSTEM_MODULES.find(m => m.id === canonical);
      if (found) return found.pageId;
      return first;
    }
  }

  return 'sauda';
}

/**
 * Broadcast permission update event across windows and components
 */
export function broadcastPermissionsUpdated(detail: {
  userId?: string;
  username?: string;
  allowed_modules?: string;
  role?: string;
  level?: string;
}): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bally-permissions-updated', { detail }));
  }
}


