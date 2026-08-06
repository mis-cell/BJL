import React from 'react';
import { Printer, ArrowLeft, Save, Loader2 } from 'lucide-react';

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
    <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E2DFD5] px-6 py-3.5 shadow-lg flex items-center justify-between mt-6">
      <div className="flex items-center gap-3">
        {/* Print Button */}
        <button
          type="button"
          onClick={onPrint}
          className="border border-[#174C2C] text-[#174C2C] hover:bg-[#174C2C]/10 bg-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
        >
          <Printer className="h-4 w-4 text-[#174C2C]" />
          <span>Print</span>
        </button>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="border border-[#D4AF37] text-[#8B6D1B] bg-amber-50/60 hover:bg-amber-100/60 font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-[#8B6D1B]" />
          <span>Back (Esc)</span>
        </button>
      </div>

      {/* Center Branding Seal */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-[#F7F5EF] rounded-xl border border-[#E2DFD5] shadow-2xs">
        <img src="/asset_bjl.png" alt="Bally Jute Logo" className="h-6 w-auto object-contain" />
        <div className="flex flex-col">
          <span className="text-[11px] font-extrabold text-[#174C2C] leading-none">Bally Jute Limited</span>
          <span className="text-[9px] font-mono text-[#8B6D1B] mt-0.5 uppercase tracking-wider">ESTD. 1979</span>
        </div>
      </div>

      {/* Save Contract Button */}
      <button
        type="button"
        onClick={onSave}
        disabled={isLoading}
        className="bg-[#174C2C] hover:bg-[#113A21] disabled:opacity-50 text-white font-bold text-sm px-8 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
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
