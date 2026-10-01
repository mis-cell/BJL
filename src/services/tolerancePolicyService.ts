import { supabase } from '../lib/supabase';
import { dbModule } from './dbModule';
import { logChange } from './auditLogService';

export interface TolerancePolicy {
  id?: string;
  status?: string;
  policy_name: string;
  tolerance_pct: number;
  max_limit_kg?: number;
  max_limit_mt?: number;
  max_weight_limit_kg?: number;
  max_weight_limit_mt?: number;
  unit?: string;
  applicable_unit?: string;
  rule_formula?: string;
  is_active: boolean;
  is_default?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_TOLERANCE_POLICY: TolerancePolicy = {
  id: '01',
  status: 'ACTIVE',
  policy_name: 'Raw Jute Bales Standard Policy (5% or 1500 KG)',
  tolerance_pct: 5.0,
  max_limit_kg: 1500.0,
  max_limit_mt: 1.5,
  max_weight_limit_kg: 1500.0,
  max_weight_limit_mt: 1.5,
  unit: 'BALES',
  applicable_unit: 'BALES',
  rule_formula: 'Min(5% of Sauda MT, 1.500 MT)',
  is_active: true,
  is_default: true,
  description: 'Lower of 5% of Sauda contract quantity or 1,500 KG (15.00 Qtl / 1.500 MT).'
};

let cachedActivePolicy: TolerancePolicy = DEFAULT_TOLERANCE_POLICY;

export function normalizePolicyRecord(d: any): TolerancePolicy {
  const kg = Number(d.max_limit_kg || d.max_weight_limit_kg) || 1500.0;
  const mt = Number(d.max_limit_mt || d.max_weight_limit_mt) || (kg / 1000) || 1.5;
  const tolPct = Number(d.tolerance_pct) || 5.0;
  const unit = String(d.unit || d.applicable_unit || 'BALES').toUpperCase();
  const isActive = d.is_active !== undefined ? Boolean(d.is_active) : (String(d.status || '').toUpperCase() === 'ACTIVE');

  return {
    ...d,
    status: isActive ? 'ACTIVE' : 'INACTIVE',
    is_active: isActive,
    policy_name: d.policy_name || `Tolerance Policy (${tolPct}% / ${kg} KG)`,
    tolerance_pct: tolPct,
    max_limit_kg: kg,
    max_limit_mt: mt,
    max_weight_limit_kg: kg,
    max_weight_limit_mt: mt,
    unit: unit,
    applicable_unit: unit,
    rule_formula: d.rule_formula || `Min(${tolPct}% of Sauda MT, ${mt.toFixed(3)} MT)`,
    description: d.description || `Lower of ${tolPct}% of Sauda contract quantity or ${kg.toLocaleString()} KG (${(kg / 100).toFixed(2)} Qtl / ${mt.toFixed(3)} MT).`
  };
}

export async function getActiveTolerancePolicy(): Promise<TolerancePolicy> {
  try {
    if (supabase) {
      const { data: tpData, error: tpError } = await supabase
        .from('tolerance_policy')
        .select('*')
        .or('is_active.eq.true,status.ilike.ACTIVE')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!tpError && tpData && tpData.length > 0) {
        cachedActivePolicy = normalizePolicyRecord(tpData[0]);
        localStorage.setItem('active_tolerance_policy', JSON.stringify(cachedActivePolicy));
        return cachedActivePolicy;
      }

      const { data: tpmData, error: tpmError } = await supabase
        .from('tolerance_policy_master')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!tpmError && tpmData && tpmData.length > 0) {
        cachedActivePolicy = normalizePolicyRecord(tpmData[0]);
        localStorage.setItem('active_tolerance_policy', JSON.stringify(cachedActivePolicy));
        return cachedActivePolicy;
      }
    }

    const localSaved = localStorage.getItem('active_tolerance_policy');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (parsed && typeof parsed.tolerance_pct === 'number') {
          cachedActivePolicy = normalizePolicyRecord(parsed);
          return cachedActivePolicy;
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
        return normalizePolicyRecord(parsed);
      }
    }
  } catch (e) {}
  return cachedActivePolicy;
}

export async function getAllTolerancePolicies(): Promise<TolerancePolicy[]> {
  try {
    if (supabase) {
      const { data: tpData, error: tpError } = await supabase
        .from('tolerance_policy')
        .select('*')
        .order('created_at', { ascending: false });

      if (!tpError && tpData && tpData.length > 0) {
        return tpData.map(normalizePolicyRecord);
      }

      const { data: tpmData, error: tpmError } = await supabase
        .from('tolerance_policy_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (!tpmError && tpmData && tpmData.length > 0) {
        return tpmData.map(normalizePolicyRecord);
      }
    }

    const localList = localStorage.getItem('all_tolerance_policies');
    if (localList) {
      try {
        const parsed = JSON.parse(localList);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizePolicyRecord);
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error("Error fetching all tolerance policies:", err);
  }

  return [DEFAULT_TOLERANCE_POLICY];
}

export async function saveTolerancePolicy(policy: Partial<TolerancePolicy>): Promise<TolerancePolicy> {
  const nowIso = new Date().toISOString();
  const maxKg = Number(policy.max_limit_kg || policy.max_weight_limit_kg) || 1500;
  const maxMt = Number(policy.max_limit_mt || policy.max_weight_limit_mt) || (maxKg / 1000);
  const tolPct = Number(policy.tolerance_pct) || 5.0;
  const unit = String(policy.unit || policy.applicable_unit || 'BALES').toUpperCase();
  const isActive = policy.is_active !== undefined ? Boolean(policy.is_active) : true;

  const payload: TolerancePolicy = {
    policy_name: policy.policy_name || `Tolerance Policy (${tolPct}% / ${maxKg} KG)`,
    status: isActive ? 'ACTIVE' : 'INACTIVE',
    is_active: isActive,
    tolerance_pct: tolPct,
    max_limit_kg: maxKg,
    max_limit_mt: maxMt,
    max_weight_limit_kg: maxKg,
    max_weight_limit_mt: maxMt,
    unit: unit,
    applicable_unit: unit,
    rule_formula: policy.rule_formula || `Min(${tolPct}% of Sauda MT, ${maxMt.toFixed(3)} MT)`,
    description: policy.description || `Lower of ${tolPct}% of Sauda contract quantity or ${maxKg} KG (${(maxKg / 100).toFixed(2)} Qtl / ${maxMt.toFixed(3)} MT).`,
    updated_at: nowIso
  };

  if (policy.id) {
    payload.id = policy.id;
  }

  try {
    if (supabase) {
      if (payload.id) {
        await supabase.from('tolerance_policy').update(payload).eq('id', payload.id);
      } else {
        const { data } = await supabase.from('tolerance_policy').insert(payload).select().maybeSingle();
        if (data?.id) payload.id = data.id;
      }
    }
  } catch (err) {
    console.warn("Save tolerance policy warning:", err);
  }

  if (payload.is_active) {
    cachedActivePolicy = payload;
    localStorage.setItem('active_tolerance_policy', JSON.stringify(payload));
  }

  return payload;
}

export async function toggleTolerancePolicyActive(id: string, active: boolean): Promise<boolean> {
  try {
    if (supabase) {
      await supabase.from('tolerance_policy').update({ status: active ? 'ACTIVE' : 'INACTIVE', is_active: active, updated_at: new Date().toISOString() }).eq('id', id);
    }
    return true;
  } catch (err) {
    console.error("Toggle tolerance policy active failed:", err);
    return false;
  }
}

export async function deleteTolerancePolicy(id: string): Promise<boolean> {
  try {
    if (supabase) {
      await supabase.from('tolerance_policy').delete().eq('id', id);
    }
    return true;
  } catch (err) {
    console.error("Delete tolerance policy failed:", err);
    return false;
  }
}
