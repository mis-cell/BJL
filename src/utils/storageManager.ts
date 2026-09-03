/**
 * State Versioning and Storage Validation Layer
 * Protects against stale, malformed, or corrupt localStorage/sessionStorage state
 * across application updates.
 */

import { sanitizeInspectionMaster, safeRender } from "./sanitizeRecord";

export const CURRENT_APP_STORAGE_VERSION = "v2026.09.03.v1";

/**
 * Initializes state versioning on application startup.
 * Automatically purges stale cached application records if the version has changed,
 * preserving user credentials and session configuration.
 */
export function initStorageVersioning(): void {
  if (typeof window === "undefined") return;

  try {
    const activeVersion = localStorage.getItem("APP_STORAGE_VERSION");
    if (activeVersion !== CURRENT_APP_STORAGE_VERSION) {
      console.log(`[StorageManager] Upgrading storage schema from '${activeVersion || "legacy"}' to '${CURRENT_APP_STORAGE_VERSION}'`);

      // Keys to preserve across version updates
      const preserveKeys = new Set([
        "logged_in_user",
        "user_master",
        "financial_year",
        "bjl_schema_synced_v3",
        "bjl_app_db_patched_v5",
        "admindesk_tables_bootstrapped",
        "mill_operator_id",
        "GEMINI_API_KEY",
      ]);

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preserveKeys.has(key) && !key.startsWith("bjl_") && !key.startsWith("sb-")) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch (e) {}
      });

      localStorage.setItem("APP_STORAGE_VERSION", CURRENT_APP_STORAGE_VERSION);
    }
  } catch (err) {
    console.warn("[StorageManager] Error running storage versioning check:", err);
  }
}

/**
 * Safely reads and validates JSON from storage.
 */
export function getSafeStorageJSON<T>(
  key: string,
  validatorFn?: (parsed: any) => T | null,
  fallback: T | null = null
): T | null {
  if (typeof window === "undefined") return fallback;

  try {
    const item = localStorage.getItem(key);
    if (!item || item === "undefined" || item === "null") return fallback;

    const parsed = JSON.parse(item);
    if (validatorFn) {
      const validated = validatorFn(parsed);
      return validated !== null && validated !== undefined ? validated : fallback;
    }

    return parsed as T;
  } catch (err) {
    console.warn(`[StorageManager] Corrupt storage key '${key}' detected and cleared:`, err);
    try {
      localStorage.removeItem(key);
    } catch (e) {}
    return fallback;
  }
}

/**
 * Safely writes JSON to storage without crashing on quota errors.
 */
export function setSafeStorageJSON(key: string, value: any): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (value === undefined || value === null) {
      localStorage.removeItem(key);
      return true;
    }
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[StorageManager] Failed to write key '${key}' to localStorage:`, err);
    return false;
  }
}

/**
 * Validator helper specifically for cached lists of inspection records.
 */
export function validateInspectionRecordList(data: any): any[] {
  if (!Array.isArray(data)) return [];
  return data.map((rec) => sanitizeInspectionMaster(rec)).filter(Boolean);
}
