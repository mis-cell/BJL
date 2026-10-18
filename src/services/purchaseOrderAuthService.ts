import { verifyPrivilegedPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';

export interface AdminAuthResult {
  success: boolean;
  user?: {
    username: string;
    user_id: string;
    role: string;
    level: string;
  };
  error?: string;
}

export const verifyAdminOrSuperPassword = async (username: string, pass: string): Promise<AdminAuthResult> => {
  try {
    const p = await verifyPrivilegedPassword(username, pass, true);
    return { success: true, user: { username: p.username, user_id: p.user_id, role: p.role, level: p.level } };
  } catch (e: any) { return { success: false, error: e.message }; }
};

export const checkIsAdvancePaymentDone = (item: any, paymentsList: any[]): boolean => {
  if (!item) return false;
  if (item.has_payment_done === true || item.advance_payment_done === 'Yes' || item.advance_payment_done === 'yes') return true;

  const cleanPoVal = (v: any) => String(v || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
  const pPoClean = cleanPoVal(item.po_no);
  const pContractClean = cleanPoVal(item.contract_po_no);
  const ptfClean = cleanPoVal(item.ptf_no);
  const saudaClean = cleanPoVal(item.sauda_no || item.po_contract || item.contract_no);

  const poPayments = (paymentsList || []).filter((pay: any) => {
    const payPo = String(pay.po_no || pay.po_contract || pay.contract_po_no || pay.m_r_no || '').trim().toUpperCase();
    const payPoClean = cleanPoVal(payPo);
    const payMrClean = cleanPoVal(pay.mr_no);
    const paySaudaClean = cleanPoVal(pay.sauda_no);

    return (
      (pay.po_no && String(pay.po_no).trim().toUpperCase() === String(item.po_no).trim().toUpperCase()) ||
      (pay.po_no && String(pay.po_no).trim().toUpperCase() === String(item.contract_po_no).trim().toUpperCase()) ||
      (pay.po_no && item.ptf_no && String(pay.po_no).trim().toUpperCase() === String(item.ptf_no).trim().toUpperCase()) ||
      (pPoClean && pPoClean === payPoClean) ||
      (pContractClean && pContractClean === payPoClean) ||
      (ptfClean && ptfClean === payPoClean) ||
      (saudaClean && saudaClean === payPoClean) ||
      (saudaClean && saudaClean === paySaudaClean)
    );
  });

  if (poPayments.length === 0) {
    return Boolean(item.has_payment_done && !item.pending_payment);
  }

  return poPayments.some((pay: any) => {
    const advDone = String(pay.advance_payment_done || pay.advance_done || '').trim().toLowerCase();
    const paid = Number(pay.paid_amount || 0);
    const pStatus = String(pay.payment_status || pay.status || '').toLowerCase().trim();

    if (advDone === 'yes' || advDone === 'y' || advDone === 'true') {
      return true;
    }
    if (paid > 0) {
      return true;
    }
    if (pStatus === 'paid' || pStatus === 'completed' || pStatus === 'settled' || pStatus === 'partially settled') {
      return true;
    }
    return false;
  });
};

export const checkIsSettlementDone = (
  item: any,
  settlementsList: any[],
  settledDeductions: Record<string, boolean> = {}
): boolean => {
  if (!item) return false;
  if (
    item.status === 'settled' ||
    item.status === 'final' ||
    item.status === 'moved_to_final' ||
    item.has_settlement_done === true ||
    item.is_settled === true ||
    item.excess_short_status === 'settled' ||
    item.excess_short_status === 'within_bounds' ||
    item.is_within_bounds === true
  ) {
    return true;
  }

  const cleanPoVal = (v: any) => String(v || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
  const pPoClean = cleanPoVal(item.po_no);
  const pContractClean = cleanPoVal(item.contract_po_no);
  const ptfClean = cleanPoVal(item.ptf_no);
  const saudaClean = cleanPoVal(item.sauda_no || item.po_contract || item.contract_no);

  const key = String(item.po_no || '').trim().toUpperCase();
  if (
    settledDeductions &&
    (settledDeductions[key] || (item.sauda_no && settledDeductions[String(item.sauda_no).trim().toUpperCase()]))
  ) {
    return true;
  }

  return (settlementsList || []).some((s: any) => {
    const sPo = String(s.po_no || s.po_contract || s.contract_po_no || '').trim().toUpperCase();
    const sPoClean = cleanPoVal(sPo);
    return (
      (sPo && String(item.po_no || '').trim().toUpperCase() === sPo) ||
      (sPo && String(item.contract_po_no || '').trim().toUpperCase() === sPo) ||
      (sPo && item.ptf_no && String(item.ptf_no || '').trim().toUpperCase() === sPo) ||
      (pPoClean && sPoClean && pPoClean === sPoClean) ||
      (pContractClean && sPoClean && pContractClean === sPoClean) ||
      (ptfClean && sPoClean && ptfClean === sPoClean) ||
      (saudaClean && sPoClean && saudaClean === sPoClean)
    );
  });
};
