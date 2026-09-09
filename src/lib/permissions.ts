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

// Complete Master Directory of every Module, Menu, Submenu, and Page in the application
export const ALL_SYSTEM_MODULES: SystemModuleDef[] = [
  // 1. Dashboard
  {
    id: 'dashboard',
    label: 'Dashboard (Operational Hub)',
    category: 'Overview & Hub',
    pageId: 'dashboard',
    aliases: ['dashboard', 'operational_hub', 'hub', 'home']
  },

  // 2. Gate Module
  {
    id: 'main_gate',
    label: 'Main Gate (Gate Module)',
    category: 'Gate Operations',
    pageId: 'main_gate',
    aliases: ['main_gate', 'maingate', 'gate_module', 'lorry_entry', 'dispatch']
  },

  // 3. Sauda To P.O Group
  {
    id: 'satta',
    label: 'Satta Desk',
    category: 'Sauda & Procurement',
    pageId: 'satta',
    aliases: ['satta', 'satta_entry', 'satta_desk']
  },
  {
    id: 'satta_chart',
    label: 'Satta Rate Chart',
    category: 'Sauda & Procurement',
    pageId: 'satta_chart',
    aliases: ['satta_chart', 'rate_chart', 'satta_rates']
  },
  {
    id: 'sms_sauda',
    label: 'SMS Sauda Desk',
    category: 'Sauda & Procurement',
    pageId: 'sms_sauda',
    aliases: ['sms_sauda', 'sms', 'sms_desk', 'sms_interfaces']
  },
  {
    id: 'sauda',
    label: 'Sauda Desk',
    category: 'Sauda & Procurement',
    pageId: 'sauda',
    aliases: ['sauda', 'sauda_entry', 'sauda_desk', 'sauda_master']
  },
  {
    id: 'po',
    label: 'Sauda Check Point',
    category: 'Sauda & Procurement',
    pageId: 'po',
    aliases: ['po', 'sauda_check', 'sauda_po_check', 'purchase_order', 'temp_po']
  },
  {
    id: 'final_po',
    label: 'Final P.O',
    category: 'Sauda & Procurement',
    pageId: 'final_po',
    aliases: ['final_po', 'final_purchase_order', 'po_final']
  },

  // 4. Temporary Arrival To Final Arrival Group
  {
    id: 'amad',
    label: 'Temporary Arrival (Amad)',
    category: 'Arrival & Inspection',
    pageId: 'amad',
    aliases: ['amad', 'amad_entry', 'tmr', 'temporary_arrival', 'temporary_mr']
  },
  {
    id: 'final_arrival',
    label: 'Final Arrival',
    category: 'Arrival & Inspection',
    pageId: 'final_arrival',
    aliases: ['final_arrival', 'final_mr', 'final_arrival_entry']
  },
  {
    id: 'inspection',
    label: 'MILL INSPECTION',
    category: 'Arrival & Inspection',
    pageId: 'inspection',
    aliases: ['inspection', 'mill_inspection', 'mill_inspection_master', 'final_mr_inspection']
  },
  {
    id: 'material_inspection',
    label: 'INSPECTION CHECKLIST',
    category: 'Arrival & Inspection',
    pageId: 'material_inspection',
    aliases: ['material_inspection', 'inspection_checklist', 'quality_inspection']
  },
  {
    id: 'mismatch',
    label: 'Satta Mismatch Case',
    category: 'Arrival & Inspection',
    pageId: 'mismatch',
    aliases: ['mismatch', 'satta_mismatch', 'mismatch_case']
  },
  {
    id: 'material_mismatch',
    label: 'Material Mismatch Case',
    category: 'Arrival & Inspection',
    pageId: 'material_mismatch',
    aliases: ['material_mismatch', 'mat_mismatch']
  },

  // 5. Club P.O To Payment Group
  {
    id: 'club_po_mr',
    label: 'Club P.O & Arrival',
    category: 'Club & Financial',
    pageId: 'club_po_mr',
    aliases: ['club_po_mr', 'club_po', 'club_mr', 'club']
  },
  {
    id: 'payment',
    label: 'Payment Module',
    category: 'Club & Financial',
    pageId: 'payment',
    aliases: ['payment', 'payment_module', 'payments']
  },
  {
    id: 'mr_settlement',
    label: 'Settlement (M.R.)',
    category: 'Club & Financial',
    pageId: 'mr_settlement',
    aliases: ['mr_settlement', 'settlement', 'mr_claim']
  },

  // 6. Material Issue To Inventory Group
  {
    id: 'issue',
    label: 'Material Issue',
    category: 'Inventory & Issue',
    pageId: 'issue',
    aliases: ['issue', 'material_issue', 'material_issue_entry']
  },
  {
    id: 'closing_stock',
    label: 'Stock Inventory',
    category: 'Inventory & Issue',
    pageId: 'closing_stock',
    aliases: ['closing_stock', 'stock_inventory', 'stock', 'inventory']
  },
  {
    id: 'requisition_desk',
    label: 'Requisition Desk',
    category: 'Inventory & Issue',
    pageId: 'requisition_desk',
    aliases: ['requisition_desk', 'requisition', 'req_desk']
  },
  {
    id: 'bardana',
    label: 'Godown Master',
    category: 'Inventory & Issue',
    pageId: 'bardana',
    aliases: ['bardana', 'godown_master', 'godown', 'bardana_master']
  },
  {
    id: 'weight_bridge',
    label: '4.4 – Weight Bridge',
    category: 'Inventory & Issue',
    pageId: 'weight_bridge',
    aliases: ['weight_bridge', 'weigh_bridge', 'wb_view_dashboard', 'wb_stage1_create', 'wb_stage2_create', 'wb_stage3_create', 'wb_view_final']
  },

  // 7. Reports & Analytics (Individual sub-modules under Report Section)
  {
    id: 'sauda_analyze',
    label: 'Sauda Analyze (OUT)',
    category: 'Reports & Analytics',
    pageId: 'reports:sauda_analyze',
    aliases: ['sauda_analyze', 'sauda_analyze_out', 'sauda_out', 'analyze_sauda']
  },
  {
    id: 'po_summary',
    label: 'P.O. Summary',
    category: 'Reports & Analytics',
    pageId: 'reports:po_summary',
    aliases: ['po_summary', 'purchase_order_summary', 'po_sum']
  },
  {
    id: 'map_wise_po',
    label: 'Map Wise P.O',
    category: 'Reports & Analytics',
    pageId: 'reports:map_wise_po',
    aliases: ['map_wise_po', 'map_wise', 'map_po', 'po_map']
  },
  {
    id: 'global_analytics',
    label: 'Global Analytics',
    category: 'Reports & Analytics',
    pageId: 'reports:global_analytics',
    aliases: ['global_analytics', 'global_reports', 'analytics']
  },
  {
    id: 'data_aggregation',
    label: 'Data Aggregator (P.O. & Sauda)',
    category: 'Reports & Analytics',
    pageId: 'reports:data_aggregation',
    aliases: ['data_aggregation', 'data_aggregator', 'aggregator', 'po_sauda_aggregator']
  },
  {
    id: 'trade_report',
    label: 'Trade',
    category: 'Reports & Analytics',
    pageId: 'reports:trade_report',
    aliases: ['trade_report', 'trade', 'trades', 'commercial_trade', 'trade_analysis']
  },
  {
    id: 'payment_report',
    label: 'Payment Report',
    category: 'Reports & Analytics',
    pageId: 'reports:payment_report',
    aliases: ['payment_report', 'pay_report', 'reports:payment_report']
  },
  {
    id: 'reports',
    label: 'Reports Hub (All Reports)',
    category: 'Reports & Analytics',
    pageId: 'reports',
    aliases: ['reports', 'system_reports', 'analytical_reports']
  },

  // 8. System & Utilities
  {
    id: 'vyapari',
    label: 'Traders Directory',
    category: 'System & Utilities',
    pageId: 'vyapari',
    aliases: ['vyapari', 'traders_directory', 'trader_directory']
  },
  {
    id: 'settings',
    label: 'Config Center / Settings',
    category: 'System & Utilities',
    pageId: 'settings',
    aliases: ['settings', 'config_center', 'config_guide']
  },
  {
    id: 'admindesk',
    label: 'Admin Desk',
    category: 'System & Utilities',
    pageId: 'admindesk',
    aliases: ['admindesk', 'admin_desk', 'admin_vault']
  },
  {
    id: 'ai_assistant',
    label: 'Jarves AI 2.0',
    category: 'System & Utilities',
    pageId: 'ai_assistant',
    aliases: ['ai_assistant', 'jarves_ai', 'ai_portal']
  },
];

// Map of all aliases for fast lookup
export const MODULE_ALIAS_MAP: Record<string, string[]> = {};
ALL_SYSTEM_MODULES.forEach((mod) => {
  MODULE_ALIAS_MAP[mod.id] = mod.aliases;
  mod.aliases.forEach((alias) => {
    if (!MODULE_ALIAS_MAP[alias]) {
      MODULE_ALIAS_MAP[alias] = [mod.id, ...mod.aliases];
    }
  });
});

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
type PermissionListener = (context: UserContext | any) => void;
const permissionListeners = new Set<PermissionListener>();

// Cross-tab synchronization via localStorage storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'bally_last_permission_broadcast' && e.newValue) {
      try {
        const detail = JSON.parse(e.newValue);
        permissionListeners.forEach((fn) => {
          try {
            fn(detail);
          } catch (err) {
            console.warn('Cross-tab listener error:', err);
          }
        });
        window.dispatchEvent(new CustomEvent('bally-permissions-updated', { detail }));
      } catch {}
    }
  });
}

export function subscribeToPermissions(listener: PermissionListener): () => void {
  permissionListeners.add(listener);
  return () => {
    permissionListeners.delete(listener);
  };
}

export function setCurrentUserContext(context: Partial<UserContext> | null | undefined): void {
  if (context) {
    const updatedUser = context.username || context.userName || currentUserContext.username || currentUserContext.userName;
    currentUserContext = {
      ...currentUserContext,
      ...context,
      userName: updatedUser,
      username: updatedUser,
    };
    
    // Save to localStorage for persistence
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('bally_user_context', JSON.stringify(currentUserContext));
      }
    } catch (e) {
      console.warn("Could not save user context to localStorage:", e);
    }

    // Notify all subscribers
    permissionListeners.forEach((fn) => {
      try {
        fn(currentUserContext);
      } catch (err) {
        console.error("Error in permission listener:", err);
      }
    });
  }
}

export function getCurrentUserContext(): UserContext {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('bally_user_context');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          currentUserContext = { ...currentUserContext, ...parsed };
        }
      } else {
        const authSess = window.localStorage.getItem('bally_auth_session');
        if (authSess) {
          const sess = JSON.parse(authSess);
          if (sess && (sess.username || sess.userId)) {
            const mods = sess.allowed_modules
              ? sess.allowed_modules === '*'
                ? ['*']
                : String(sess.allowed_modules).split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
              : ['*'];
            currentUserContext = {
              ...currentUserContext,
              userId: sess.userId || 'op_1',
              username: sess.username,
              userName: sess.username,
              userRole: sess.role?.toUpperCase() || 'L1',
              userLevel: sess.level?.toUpperCase() || 'L1',
              allowedModules: mods,
            };
          }
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
    allowed = roleOrContext.allowedModules || [];
  } else {
    const ctx = getCurrentUserContext();
    role = (ctx?.userRole || '').toUpperCase();
    level = (ctx?.userLevel || '').toUpperCase();
    allowed = ctx?.allowedModules || [];
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
 * Checks if the current user has permission to view/access a given module, menu, or page.
 * 
 * Rules:
 * 1. Admin or full access ('*') returns TRUE for everything.
 * 2. If user has specific modules (e.g. ['sauda']), only matches to 'sauda' (and its known aliases) return TRUE.
 * 3. All other modules return FALSE.
 */
export function hasModulePermission(
  targetModuleOrPage: string,
  allowedModulesOverride?: string[] | string,
  isAdminOverride?: boolean
): boolean {
  if (!targetModuleOrPage) return false;

  const isAdmin = isAdminOverride !== undefined ? isAdminOverride : isUserAdmin();
  if (isAdmin) return true;

  const target = targetModuleOrPage.toLowerCase().trim();

  // 1. Universal Hub Access: The operational Dashboard is the landing hub and home for all authenticated operators.
  // The Dashboard component itself dynamically filters and displays ONLY the module cards permitted for this operator.
  if (target === 'dashboard' || target === 'hub' || target === 'operational_hub' || target === 'home') {
    return true;
  }

  const ctx = getCurrentUserContext();
  const rawList = allowedModulesOverride !== undefined
    ? allowedModulesOverride
    : (ctx.allowedModules || []);

  const cleanAllowed = (
    Array.isArray(rawList)
      ? rawList
      : typeof rawList === 'string'
        ? String(rawList).split(',')
        : []
  ).map((m) => String(m).toLowerCase().trim()).filter(Boolean);

  if (cleanAllowed.includes('*')) return true;

  // 2. Direct match
  if (cleanAllowed.includes(target)) {
    return true;
  }

  // 2b. Handle compound report module IDs like reports:sauda_analyze or reports:trade
  if (target.startsWith('reports:')) {
    const subTarget = target.replace('reports:', '').trim().toLowerCase();
    if (cleanAllowed.includes('reports') || cleanAllowed.includes(subTarget)) {
      return true;
    }
    const subAliases = MODULE_ALIAS_MAP[subTarget] || [subTarget];
    for (const alias of subAliases) {
      if (cleanAllowed.includes(alias.toLowerCase())) {
        return true;
      }
    }
  }

  // 2c. If checking parent 'reports', permit if user has access to ANY report submodule
  if (target === 'reports') {
    if (cleanAllowed.includes('reports')) return true;
    const REPORT_SUB_MODULES = [
      'sauda_analyze', 'po_summary', 'map_wise_po', 'global_analytics', 
      'data_aggregation', 'trade_report', 'trade', 'payment_report'
    ];
    for (const sub of REPORT_SUB_MODULES) {
      if (cleanAllowed.includes(sub)) return true;
      const subAliases = MODULE_ALIAS_MAP[sub] || [];
      if (subAliases.some(a => cleanAllowed.includes(a.toLowerCase()))) return true;
    }
  }

  // 3. Match against module definition labels, ids, or aliases
  for (const mod of ALL_SYSTEM_MODULES) {
    if (mod.id.toLowerCase() === target || mod.pageId.toLowerCase() === target) {
      if (cleanAllowed.includes(mod.id.toLowerCase()) || cleanAllowed.includes(mod.label.toLowerCase())) {
        return true;
      }
      for (const alias of mod.aliases) {
        if (cleanAllowed.includes(alias.toLowerCase())) {
          return true;
        }
      }
    }
  }

  // 4. Check aliases of target against cleanAllowed
  const targetAliases = MODULE_ALIAS_MAP[target] || [target];
  for (const alias of targetAliases) {
    if (cleanAllowed.includes(alias.toLowerCase())) {
      return true;
    }
  }

  // 5. Check if any allowed item lists target as an alias
  for (const allowedItem of cleanAllowed) {
    const aliasesOfAllowed = MODULE_ALIAS_MAP[allowedItem] || [];
    if (aliasesOfAllowed.map(a => a.toLowerCase()).includes(target)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter an array of navigation menus by user permissions.
 * 
 * Rules:
 * - If a menu has `subItems`, filter each subItem.
 * - If a parent menu has NO permitted subItems, COMPLETELY HIDE the parent menu.
 * - If a menu has no `subItems` (leaf menu like Dashboard or Reports), check its pageId/id.
 */
export function filterMenuByPermissions<T extends { id: string; pageId?: string; subItems?: any[] }>(
  menus: T[],
  allowedModulesOverride?: string[] | string,
  isAdminOverride?: boolean
): T[] {
  const result: T[] = [];

  for (const menu of menus) {
    if (menu.subItems && menu.subItems.length > 0) {
      // Filter child subItems
      const permittedSubItems = menu.subItems.filter((sub) => {
        const checkId = sub.pageId || sub.id;
        return hasModulePermission(checkId, allowedModulesOverride, isAdminOverride);
      });

      // Only include parent menu if at least one child is permitted!
      if (permittedSubItems.length > 0) {
        result.push({
          ...menu,
          subItems: permittedSubItems,
        });
      }
    } else {
      // Leaf menu (e.g. dashboard, reports)
      const checkId = menu.pageId || menu.id;
      if (hasModulePermission(checkId, allowedModulesOverride, isAdminOverride)) {
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
  allowedModulesOverride?: string[] | string,
  isAdminOverride?: boolean
): string {
  const isAdmin = isAdminOverride !== undefined ? isAdminOverride : isUserAdmin();
  if (isAdmin) return 'dashboard';

  const ctx = getCurrentUserContext();
  const rawList = allowedModulesOverride !== undefined
    ? allowedModulesOverride
    : (ctx.allowedModules || []);

  const allowedList = (
    Array.isArray(rawList)
      ? rawList
      : typeof rawList === 'string'
        ? String(rawList).split(',')
        : []
  ).map((m) => String(m).toLowerCase().trim()).filter(Boolean);

  if (allowedList.includes('*')) return 'dashboard';
  if (hasModulePermission('dashboard', allowedList, false)) return 'dashboard';

  // Find the first registered module that is permitted
  for (const mod of ALL_SYSTEM_MODULES) {
    if (mod.id !== 'dashboard' && hasModulePermission(mod.id, allowedList, false)) {
      return mod.pageId;
    }
  }

  // If nothing matched in ALL_SYSTEM_MODULES, check if any item in allowedList matches a page
  for (const item of allowedList) {
    if (item && item !== '*') {
      const found = ALL_SYSTEM_MODULES.find(m => m.id === item || m.aliases.includes(item));
      if (found) return found.pageId;
    }
  }

  // Universal safe fallback is ALWAYS dashboard, NEVER 'sauda'
  return 'dashboard';
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
    const parsedMods = detail.allowed_modules
      ? detail.allowed_modules === '*'
        ? ['*']
        : String(detail.allowed_modules).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : ['*'];

    const normalizedContext: UserContext = {
      userId: detail.userId || currentUserContext.userId,
      username: detail.username || currentUserContext.username,
      userName: detail.username || currentUserContext.userName,
      userRole: detail.role || currentUserContext.userRole,
      userLevel: detail.level || currentUserContext.userLevel,
      allowedModules: parsedMods,
      permissions: currentUserContext.permissions || ['ALL', 'EDIT', 'DELETE', 'VIEW']
    };

    // If currently logged in user matches, update in-memory context and local storage immediately
    const currentUsername = currentUserContext.username || currentUserContext.userName;
    if (
      !currentUsername ||
      !detail.username ||
      currentUsername.toLowerCase() === detail.username.toLowerCase()
    ) {
      setCurrentUserContext(normalizedContext);
      try {
        const authSess = window.localStorage.getItem('bally_auth_session');
        if (authSess) {
          const sess = JSON.parse(authSess);
          if (sess && sess.username && sess.username.toLowerCase() === (detail.username || '').toLowerCase()) {
            sess.allowed_modules = detail.allowed_modules;
            sess.role = detail.role || sess.role;
            sess.level = detail.level || sess.level;
            window.localStorage.setItem('bally_auth_session', JSON.stringify(sess));
          }
        }
      } catch {}
    }

    // 1. Notify in-memory listeners
    permissionListeners.forEach((fn) => {
      try {
        fn(normalizedContext);
      } catch (e) {
        console.warn('Listener notification error:', e);
      }
    });

    // 2. Dispatch window event with both raw and parsed format for compatibility
    window.dispatchEvent(
      new CustomEvent('bally-permissions-updated', {
        detail: {
          ...detail,
          allowedModules: parsedMods,
          normalizedContext,
        },
      })
    );

    // 3. Multi-tab synchronization via localStorage
    try {
      localStorage.setItem(
        'bally_last_permission_broadcast',
        JSON.stringify({
          ...detail,
          allowedModules: parsedMods,
          _timestamp: Date.now(),
        })
      );
    } catch {}
  }
}

