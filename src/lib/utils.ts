import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiUrl(apiPath: string): string {
  const cleanPath = apiPath.startsWith('/') ? apiPath.substring(1) : apiPath;
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isCloudRun = hostname.endsWith('run.app');

    // Email sending has no server on GitHub Pages (static hosting can't run
    // Node/SMTP). It is handled by a Supabase Edge Function that holds the Gmail
    // credentials as secrets and returns proper CORS headers. When we are NOT on
    // localhost (where server.ts runs directly), route send-email there.
    const SUPABASE_FUNCTIONS_BASE = 'https://lxuapkccxaadwixjpirs.supabase.co/functions/v1';
    if (!isLocalhost && cleanPath.endsWith('api/send-email')) {
      return `${SUPABASE_FUNCTIONS_BASE}/send-email`;
    }

    // For static hosting (e.g. GitHub Pages) where backend server is not hosted on same origin,
    // fallback to current origin or relative endpoint to avoid CORS issues with expired endpoints.
    if (!isLocalhost && !isCloudRun) {
      const pathname = window.location.pathname;
      if (pathname.includes('Jute-Purchase-Automation')) {
        return `/Jute-Purchase-Automation/${cleanPath}`;
      }
      return `/${cleanPath}`;
    }

    const pathname = window.location.pathname;
    
    // In the user's environment, the app runs behind "/Jute-Purchase-Automation" subpath
    if (pathname.includes('Jute-Purchase-Automation')) {
      return `/Jute-Purchase-Automation/${cleanPath}`;
    }
    
    const parts = pathname.split('/');
    if (parts.length > 1 && parts[1] === 'Jute-Purchase-Automation') {
      return `/Jute-Purchase-Automation/${cleanPath}`;
    }
  }
  
  return `/${cleanPath}`;
}

export function formatDate(date?: string | Date | null): string {
  if (!date || String(date).trim() === '' || String(date).trim() === 'null' || String(date).trim() === 'undefined' || String(date).trim() === '-') {
    return 'DD-MM-YYYY';
  }
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      const parts = String(date).trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD -> DD-MM-YYYY
          return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
        }
        return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
      }
      return 'DD-MM-YYYY';
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return 'DD-MM-YYYY';
  }
}

/**
 * Sanitizes data for CSV export to prevent Formula Injection Attacks (CSV Injection)
 * Escapes fields that start with '=', '+', '-', or '@'.
 */
export function sanitizeCsvData(data: any[]): any[] {
  if (!Array.isArray(data)) return data;
  
  return data.map(row => {
    if (typeof row !== 'object' || row === null) return row;
    
    const sanitizedRow: any = {};
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        let value = row[key];
        
        if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
          // Prepend with a single quote to force Excel/Calc to treat as text
          value = "'" + value;
        }
        
        sanitizedRow[key] = value;
      }
    }
    return sanitizedRow;
  });
}

import { getCurrentUserContext } from './permissions';

export function canDeleteData(): boolean {
  const ctx = getCurrentUserContext();
  return (ctx.userRole || '').toUpperCase() === 'ADMIN';
}

export function canApproveMismatch(): boolean {
  const ctx = getCurrentUserContext();
  const role = (ctx.userRole || '').toUpperCase();
  const level = (ctx.userLevel || '').toUpperCase();
  return (
    role === 'ADMIN' ||
    role === 'ADMINISTRATOR' ||
    level === 'L3' ||
    level === 'L5' ||
    level === 'MAX' ||
    level === 'ADMIN' ||
    level === 'ADMINISTRATOR'
  );
}
