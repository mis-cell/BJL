export interface UserContext {
  userId?: string;
  userName?: string;
  userRole?: string;
  userLevel?: string;
  permissions?: string[];
  [key: string]: any;
}

let currentUserContext: UserContext = {
  userId: 'default_operator',
  userName: 'Operator',
  userRole: 'ADMIN',
  userLevel: 'L5',
  permissions: ['ALL', 'EDIT', 'DELETE', 'VIEW'],
};

export function setCurrentUserContext(context: Partial<UserContext> | null | undefined): void {
  if (context) {
    currentUserContext = {
      ...currentUserContext,
      ...context,
    };
  }
}

export function getCurrentUserContext(): UserContext {
  return currentUserContext;
}

export function isUserAdmin(): boolean {
  const ctx = getCurrentUserContext();
  const role = (ctx?.userRole || '').toUpperCase();
  const level = (ctx?.userLevel || '').toUpperCase();
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
