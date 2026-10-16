import React from 'react';
import { Printer, ArrowLeft, Save, Loader2, Lock } from 'lucide-react';

interface FooterActionsProps {
  onPrint?: () => void;
  onBack?: () => void;
  onSave?: () => void;
  isLoading?: boolean;
  isLocked?: boolean;
  lockedMessage?: string;
}

export const FooterActions: React.FC<FooterActionsProps> = ({
  onPrint,
  onBack,
  onSave,
  isLoading = false,
  isLocked = false,
  lockedMessage
}) => {
  return (
    <div className="bg-[#FDE7E6] border-t border-[#FBCFCB] px-6 py-3.5 flex items-center justify-between text-[#171717] -mx-5 -mb-5 mt-5 rounded-b-[17px]">
      <div className="flex items-center gap-3">
        {/* Print Button */}
        <button
          type="button"
          onClick={onPrint}
          className="bg-[#FFFBEB] hover:bg-[#FFF2CC] active:bg-[#FFE08A] text-[#111111] border border-[#FFE08A] font-bold text-xs px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
        >
          <Printer className="h-4 w-4 text-[#D94B5A]" />
          <span>Print</span>
        </button>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="bg-white hover:bg-slate-100 active:bg-slate-200 text-[#171717] border border-[#CBD5E1] font-bold text-xs px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-[#404040]" />
          <span>Back (Esc)</span>
        </button>
      </div>

      {/* Center Branding */}
      <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-white rounded-lg border border-[#FBCFCB]">
        <span className="text-[11px] font-extrabold text-[#171717] tracking-wider font-sans">BALLY JUTE COMPANY LIMITED</span>
        <span className="text-[9px] font-mono text-[#D94B5A] uppercase tracking-widest font-bold">• ESTD. 1979</span>
      </div>

      {/* Save Contract Button / Locked Badge */}
      {isLocked ? (
        <div
          title={lockedMessage || "🔒 Locked: This contract was approved. Only Admin can edit."}
          className="bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed select-none shadow-inner"
        >
          <Lock className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="tracking-wide uppercase font-black text-xs">LOCKED (ADMIN ONLY)</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={isLoading}
          className="bg-[#D94B5A] hover:bg-[#E85A5A] active:bg-[#B93847] disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-8 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 tracking-wider uppercase border border-[#D94B5A]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>SAVING CONTRACT...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 text-white" />
              <span>SAVE CONTRACT</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default FooterActions;
