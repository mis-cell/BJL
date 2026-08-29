import React from 'react';
import { Sparkles, Asterisk, Edit3 } from 'lucide-react';

interface FormLegendProps {
  className?: string;
  showCalculated?: boolean;
}

export const FormLegend: React.FC<FormLegendProps> = ({
  className = "",
  showCalculated = true
}) => {
  return (
    <div className={`bg-gradient-to-r from-sky-50 via-amber-50/60 to-emerald-50/50 border border-slate-300/80 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs text-xs font-semibold ${className}`}>
      <div className="flex items-center gap-1.5 text-slate-700 font-bold">
        <span className="uppercase text-[10px] tracking-wider text-slate-500">Visual Guide:</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {/* Auto Populated */}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-sky-100 border border-sky-400 flex items-center justify-center text-sky-700 shadow-2xs">
            <Sparkles className="w-2.5 h-2.5" />
          </span>
          <span className="text-[11px] text-sky-950 font-bold">
            Light Blue: <span className="font-semibold text-sky-800">Auto Populated / Synced Data</span>
          </span>
        </div>

        {/* Mandatory */}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-500 flex items-center justify-center text-rose-600 font-black text-[10px] shadow-2xs">
            *
          </span>
          <span className="text-[11px] text-amber-950 font-bold">
            Amber Border (*): <span className="font-semibold text-amber-800">Mandatory Required Field</span>
          </span>
        </div>

        {/* User Input */}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-500 shadow-2xs">
            <Edit3 className="w-2.5 h-2.5" />
          </span>
          <span className="text-[11px] text-slate-800 font-bold">
            White: <span className="font-semibold text-slate-600">Manual User Input</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default FormLegend;
