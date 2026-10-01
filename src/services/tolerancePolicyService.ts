import { supabase } from '../lib/supabase';
import { dbModule } from './dbModule';
import { logChange } from './auditLogService';

export interface TolerancePolicy {
  id?: string;
  policy_name: string;
  tolerance_pct: number;
  max_weight_limit_kg: number;
  max_weight_limit_mt: number;
  applicable_unit: string;
  is_active: boolean;
  is_default?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_TOLERANCE_POLICY: TolerancePolicy = {
  id: 'default-policy-bales-5pct-1500kg',
  policy_name: 'Raw Jute Bales Standard Policy (5% or 1500 KG)',
  tolerance_pct: 5.0,
  max_weight_limit_kg: 1500.0,
  max_weight_limit_mt: 1.5,
  applicable_unit: 'BALES',
  is_active: true,
  is_default: true,
  description: 'Allowed tolerance is the lower of 5% of Sauda contract quantity or 1,500 KG (15.00 Qtl / 1.500 MT).'
};

let cachedActivePolicy: TolerancePolicy = DEFAULT_TOLERANCE_POLICY;

export async function getActiveTolerancePolicy(): Promise<TolerancePolicy> {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('tolerance_policy_master')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        cachedActivePolicy = {
          ...data[0],
          tolerance_pct: Number(data[0].tolerance_pct) || 5.0,
          max_weight_limit_kg: Number(data[0].max_weight_limit_kg) || 1500.0,
          max_weight_limit_mt: Number(data[0].max_weight_limit_mt) || (Number(data[0].max_weight_limit_kg) / 1000) || 1.5
        };
        localStorage.setItem('active_tolerance_policy', JSON.stringify(cachedActivePolicy));
        return cachedActivePolicy;
      }
    }

    const localSaved = localStorage.getItem('active_tolerance_policy');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (parsed && typeof parsed.tolerance_pct === 'number') {
          cachedActivePolicy = parsed;
          return parsed;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn("Could not fetch active tolerance policy from database, using cached/default:", err);
  }

  return cachedActivePolicy;
}

export function getCachedTolerancePolicy(): TolerancePolicy {
  try {
    const localSaved = localStorage.getItem('active_tolerance_policy');
    if (localSaved) {
      const parsed = JSON.parse(localSaved);
      if (parsed && typeof parsed.tolerance_pct === 'number') {
        return parsed;
      }
    }
  } catch (e) {}
  return cachedActivePolicy;
}

export async function getAllTolerancePolicies(): Promise<TolerancePolicy[]> {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('tolerance_policy_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          ...d,
          tolerance_pct: Number(d.tolerance_pct) || 5.0,
          max_weight_limit_kg: Number(d.max_weight_limit_kg) || 1500.0,
          max_weight_limit_mt: Number(d.max_weight_limit_mt) || (Number(d.max_weight_limit_kg) / 1000) || 1.5
        }));
      }
    }

    const localList = localStorage.getItem('all_tolerance_policies');
    if (localList) {
      try {
        const parsed = JSON.parse(localList);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
  } catch (err) {
    console.error("Error fetching all tolerance policies:", err);
  }

  return [DEFAULT_TOLERANCE_POLICY];
}

export async function saveTolerancePolicy(policy: Partial<TolerancePolicy>): Promise<TolerancePolicy> {
  const nowIso = new Date().toISOString();
  const maxKg = Number(policy.max_weight_limit_kg) || 1500;
  const maxMt = Number(policy.max_weight_limit_mt) || (maxKg / 1000);
  const tolPct = Number(policy.tolerance_pct) || 5.0;

  const payload: TolerancePolicy = {
    policy_name: policy.policy_name || `Tolerance Policy (${tolPct}% / ${maxKg} KG)`,
    tolerance_pct: tolPct,
    max_weight_limit_kg: maxKg,
    max_weight_limit_mt: maxMt,
    applicable_unit: String(policy.applicable_unit || 'BALES').toUpperCase(),
    is_active: policy.is_active !== undefined ? policy.is_active : true,
    is_default: Boolean(policy.is_default),
    description: policy.description || `Lower of ${tolPct}% or ${maxKg} KG (${(maxKg / 100).toFixed(2)} Qtl / ${maxMt.toFixed(3)} MT)`,
    updated_at: nowIso
  };

  if (policy.id && !policy.id.startsWith('default-')) {
    payload.id = policy.id;
  }

  try {
    if (supabase) {
      if (payload.is_active) {
        // If activating this policy, optionally deactivate other policies of the same unit
        await supabase
          .from('tolerance_policy_master')
          .update({ is_active: false })
          .eq('applicable_unit', payload.applicable_unit);
      }

      if (payload.id) {
        const { data, error } = await supabase
          .from('tolerance_policy_master')
          .update(payload)
          .eq('id', payload.id)
          .select()
          .single();
        if (error) throw error;
        cachedActivePolicy = data;
      } else {
        payload.created_at = nowIso;
        const { data, error } = await supabase
          .from('tolerance_policy_master')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        cachedActivePolicy = data;
        payload.id = data.id;
      }
    }

    if (payload.is_active) {
      cachedActivePolicy = payload;
      localStorage.setItem('active_tolerance_policy', JSON.stringify(payload));
    }

    // Record audit log
    await logChange({
      module: 'Admin Desk / Policy Master',
      entity_name: 'Tolerance Policy Master',
      record_id: payload.id || payload.policy_name,
      action: payload.id ? 'UPDATE' : 'CREATE',
      field_name: 'tolerance_policy',
      field_label: payload.policy_name,
      old_value: 'N/A',
      new_value: `${payload.tolerance_pct}% / ${payload.max_weight_limit_kg} KG (${payload.is_active ? 'ACTIVE' : 'INACTIVE'})`,
      user_name: 'Admin',
      remarks: `Updated tolerance policy configuration`
    });

    return cachedActivePolicy;
  } catch (err: any) {
    console.error("Error saving tolerance policy:", err);
    // Local fallback
    cachedActivePolicy = payload;
    localStorage.setItem('active_tolerance_policy', JSON.stringify(payload));
    return payload;
  }
}

export async function toggleTolerancePolicyActive(id: string, is_active: boolean): Promise<boolean> {
  try {
    if (supabase && id && !id.startsWith('default-')) {
      if (is_active) {
        // Deactivate other policies
        await supabase
          .from('tolerance_policy_master')
          .update({ is_active: false })
          .neq('id', id);
      }
      await supabase
        .from('tolerance_policy_master')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    const current = getCachedTolerancePolicy();
    if (current.id === id || is_active) {
      current.is_active = is_active;
      cachedActivePolicy = current;
      localStorage.setItem('active_tolerance_policy', JSON.stringify(current));
    }

    return true;
  } catch (err) {
    console.error("Error toggling tolerance policy:", err);
    return false;
  }
}

export async function deleteTolerancePolicy(id: string): Promise<boolean> {
  try {
    if (supabase && id && !id.startsWith('default-')) {
      await supabase.from('tolerance_policy_master').delete().eq('id', id);
    }
    return true;
  } catch (err) {
    console.error("Error deleting tolerance policy:", err);
    return false;
  }
}
