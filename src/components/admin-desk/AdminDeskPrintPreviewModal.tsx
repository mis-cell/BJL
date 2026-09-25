import React from 'react';
import { X, Printer } from 'lucide-react';
import { PrintQueueItem } from './adminDeskTypes';

interface AdminDeskPrintPreviewModalProps {
  printingItem: PrintQueueItem | null;
  onClose: () => void;
}

export const AdminDeskPrintPreviewModal: React.FC<AdminDeskPrintPreviewModalProps> = ({
  printingItem,
  onClose
}) => {
  if (!printingItem) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Print Preview: {printingItem.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-b pb-2">
              <span>REF: <strong className="text-slate-800 font-mono">{printingItem.refNo}</strong></span>
              <span>MODULE: <strong className="text-indigo-600 uppercase">{printingItem.module}</strong></span>
              <span>QUEUED: <strong className="text-slate-800 font-mono">{new Date(printingItem.timestamp).toLocaleDateString()}</strong></span>
            </div>
            <p className="text-xs text-slate-700 font-medium italic pt-1">{printingItem.summary}</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg font-mono text-[11px] text-emerald-400 overflow-x-auto border border-slate-800">
            <span className="text-slate-500 font-bold block mb-2 text-[10px] uppercase border-b border-slate-800 pb-1">Payload Document Object</span>
            <pre className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(printingItem.payload, null, 2)}</pre>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={() => {
              window.print();
            }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Send to Printer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
