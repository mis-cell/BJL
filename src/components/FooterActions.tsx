import React from 'react';
import { Printer, ArrowLeft, Save, Loader2, Building2 } from 'lucide-react';

interface FooterActionsProps {
  onPrint?: () => void;
  onBack?: () => void;
  onSave?: () => void;
  isLoading?: boolean;
}

export const FooterActions: React.FC<FooterActionsProps> = ({
  onPrint,
  onBack,
  onSave,
  isLoading = false
}) => {
  return (
    <div className="sticky bottom-0 z-30 bg-white border-t border-slate-200 px-6 py-3.5 shadow-lg flex items-center justify-between mt-6">
      <div className="flex items-center gap-3">
        {/* Print Button */}
        <button
          type="button"
          onClick={onPrint}
          className="border-2 border-[#174C2C] text-[#174C2C] hover:bg-[#174C2C]/10 bg-white font-bold text-xs px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
        >
          <Printer className="h-4 w-4 text-[#174C2C]" />
          <span>Print</span>
        </button>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="border-2 border-[#D4AF37] text-[#8B6D1B] bg-white hover:bg-amber-50/60 font-bold text-xs px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-[#8B6D1B]" />
          <span>Back (Esc)</span>
        </button>
      </div>

      {/* Save Contract Button */}
      <button
        type="button"
        onClick={onSave}
        disabled={isLoading}
        className="bg-[#174C2C] hover:bg-[#123E23] disabled:opacity-50 text-white font-black text-xs sm:text-sm px-8 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 tracking-wider uppercase"
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
    </div>
  );
};

export default FooterActions;
