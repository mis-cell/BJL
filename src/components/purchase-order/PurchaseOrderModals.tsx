import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mail,
  Trash2,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  AlertTriangle,
  Edit
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { isUserAdmin, isL5OrAdmin } from '../../lib/permissions';

export interface ActionMenuState {
  x: number;
  y: number;
  item: any;
}

export interface EmailNotificationState {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'info' | 'default';
  resolve: (value: boolean) => void;
}

// 1. Action Menu Portal
export const PoActionMenuPortal: React.FC<{
  actionMenu: ActionMenuState | null;
  onClose: () => void;
  onSendMail: (item: any) => void;
  onDelete: (poNo: string) => void;
}> = ({ actionMenu, onClose, onSendMail, onDelete }) => {
  if (!actionMenu) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} />
      <div
        className="fixed z-[1000] bg-white rounded-2xl shadow-2xl border border-slate-200 p-1 text-xs w-40 animate-in fade-in zoom-in-95 duration-100"
        style={{ top: actionMenu.y + 4, left: Math.max(8, actionMenu.x - 160) }}
      >
        <button
          onClick={() => {
            const it = actionMenu.item;
            onClose();
            onSendMail(it);
          }}
          className="w-full text-left px-3 py-2 hover:bg-indigo-50/70 rounded-xl flex items-center gap-2.5 text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
        >
          <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Email</span>
        </button>
        <div className="border-t border-slate-100 my-0.5" />
        <button
          onClick={() => {
            const po = actionMenu.item.po_no;
            onClose();
            onDelete(po);
          }}
          disabled={!isUserAdmin() && !isL5OrAdmin()}
          className={cn(
            "w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 font-bold text-xs transition-colors cursor-pointer",
            !isUserAdmin() && !isL5OrAdmin()
              ? "opacity-40 cursor-not-allowed text-slate-400"
              : "hover:bg-rose-50 text-rose-700"
          )}
          title={!isUserAdmin() && !isL5OrAdmin() ? "Admin permission required to delete Sauda records" : "Delete Sauda record"}
        >
          <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Delete</span>
        </button>
      </div>
    </>,
    document.body
  );
};

// 2. Email / Action Toast Notification
export const PoEmailToastNotification: React.FC<{
  notification: EmailNotificationState | null;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  if (!notification) return null;

  return createPortal(
    <div className="fixed top-6 right-6 z-[2000] flex items-start gap-3 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xl max-w-sm animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        className={cn(
          "p-2 rounded-xl shrink-0 mt-0.5",
          notification.type === 'success' ? "bg-emerald-100 text-emerald-700" :
          notification.type === 'warning' ? "bg-amber-100 text-amber-800" :
          notification.type === 'info' ? "bg-blue-100 text-blue-800" :
          "bg-rose-100 text-rose-700"
        )}
      >
        {notification.type === 'success' ? (
          <Check className="w-5 h-5" />
        ) : notification.type === 'info' ? (
          <Clock className="w-5 h-5" />
        ) : (
          <AlertCircle className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 pr-2">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
          {notification.title}
        </h4>
        <p className="text-[11px] font-medium text-slate-600 mt-0.5 leading-relaxed">
          {notification.message}
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>,
    document.body
  );
};

// 3. Confirm Modal
export const GlobalConfirmModal: React.FC<{
  confirmState: ConfirmDialogState | null;
  onDismiss: () => void;
}> = ({ confirmState, onDismiss }) => {
  if (!confirmState) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => {
        confirmState.resolve(false);
        onDismiss();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "px-5 py-3 flex items-center gap-2 text-white",
            confirmState.tone === 'danger'
              ? 'bg-gradient-to-r from-rose-600 to-red-700'
              : 'bg-gradient-to-r from-indigo-600 to-blue-700'
          )}
        >
          {confirmState.tone === 'danger' ? (
            <Trash2 className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span className="font-black text-sm uppercase tracking-wide">{confirmState.title}</span>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
          {confirmState.message}
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={() => {
              confirmState.resolve(false);
              onDismiss();
            }}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              confirmState.resolve(true);
              onDismiss();
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-black text-white shadow transition",
              confirmState.tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            )}
          >
            {confirmState.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// 4. Reopen Success Info Modal
export const ReopenSuccessModal: React.FC<{
  info: { po: any; openRemarks: any } | null;
  onClose: () => void;
  onEditNow: (po: any) => void;
}> = ({ info, onClose, onEditNow }) => {
  if (!info) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-emerald-600 p-5 text-white text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-wide">Sauda Reopened!</h3>
          <p className="text-xs text-emerald-100 mt-1 font-mono">Sauda #{info.po.po_no} is now OPEN</p>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Reopened By:</span>
              <span className="font-bold text-slate-800">{info.openRemarks.opened_by}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Date & Time:</span>
              <span className="font-mono text-slate-800">
                {info.openRemarks.formatted_time || info.openRemarks.timestamp}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2">
              <span className="text-slate-500 font-medium block mb-1">Remarks:</span>
              <p className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800 italic">
                "{info.openRemarks.remarks}"
              </p>
            </div>
          </div>

          <p className="text-center text-slate-600 font-medium">
            The Sauda is now active. You can now edit it or view its details.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                const po = info.po;
                onClose();
                onEditNow(po);
              }}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Sauda Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Audit View Modal
export const ReopenAuditLogModal: React.FC<{
  auditViewPo: any | null;
  onClose: () => void;
}> = ({ auditViewPo, onClose }) => {
  if (!auditViewPo) return null;

  let rData = auditViewPo.open_remarks;
  if (typeof rData === 'string') {
    try {
      rData = JSON.parse(rData);
    } catch (e) {}
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-indigo-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide text-white">Reopen Audit Details</h3>
              <p className="text-[11px] text-indigo-200 font-mono">Sauda #{auditViewPo.po_no}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {!rData ? (
            <p className="text-slate-500 italic p-4 text-center">No open_remarks audit data found for this Sauda.</p>
          ) : (
            <>
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Opened By:</span>
                  <span className="font-bold text-indigo-900 text-sm">{rData.opened_by}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">User Role / Level:</span>
                  <span className="font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-mono text-[11px]">
                    {rData.user_role || 'ADMIN'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Timestamp:</span>
                  <span className="font-mono text-slate-800">{rData.formatted_time || rData.timestamp}</span>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <span className="text-slate-500 font-medium block mb-1">Remarks provided:</span>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-800 font-medium leading-relaxed">
                    {rData.remarks}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Stored Supabase JSON Payload:
                </span>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-36">
                  {JSON.stringify(rData, null, 2)}
                </pre>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Close Audit View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 6. Mismatch Resolution Modal
export const MismatchApprovalModal: React.FC<{
  mismatchModalPo: any | null;
  onClose: () => void;
  getMismatchReasonText: (po: any) => string;
  onApprove: (po: any) => void;
}> = ({ mismatchModalPo, onClose, getMismatchReasonText, onApprove }) => {
  if (!mismatchModalPo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-gradient-to-r from-rose-700 to-rose-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide text-white">Sauda Mismatch Details & Approval</h3>
              <p className="text-[11px] text-rose-200 font-mono">Sauda #{mismatchModalPo.po_no}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rose-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="bg-rose-50 rounded-xl p-3.5 border border-rose-200 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-rose-950">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Mismatch Discrepancy Detected</span>
            </div>
            <p className="text-slate-700 leading-relaxed font-medium">
              Reason: <span className="font-bold text-rose-900">{getMismatchReasonText(mismatchModalPo)}</span>
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans font-medium">Broker:</span>
              <span className="font-bold text-slate-900 uppercase">{mismatchModalPo.broker || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans font-medium">Supplier:</span>
              <span className="font-bold text-slate-900 uppercase">{mismatchModalPo.supplier || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans font-medium">Contract Quantity:</span>
              <span className="font-bold text-slate-900">{parseFloat(mismatchModalPo.total_contract_mt || 0).toFixed(3)} MT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans font-medium">Received Weight:</span>
              <span className="font-bold text-slate-900">{Number(mismatchModalPo.received_weight_mt || 0).toFixed(3)} MT</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic text-center">
            Approving this mismatch will resolve the discrepancy and update the status to PASS on the Sauda Check Point dashboard.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApprove(mismatchModalPo)}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Approve & Set PASS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
