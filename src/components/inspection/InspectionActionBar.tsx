import React from "react";
import { ShieldCheck, ArrowLeft, Plus, RefreshCw } from "lucide-react";

export interface InspectionActionBarProps {
  viewMode: "dashboard" | "form";
  onBack: () => void;
  onOpenNewForm: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export const InspectionActionBar: React.FC<InspectionActionBarProps> = ({
  viewMode,
  onBack,
  onOpenNewForm,
  onRefresh,
  loading,
}) => {
  return (
    <div className="bg-[#174C2C] border-b border-[#0F351E] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-bold text-white tracking-wide">
            {viewMode === "form" ? "Mill Inspection Information Entry" : "INSPECTION MODULE REGISTER"}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {viewMode === "form" ? (
          <div className="relative z-10 flex items-center gap-3">
            <button
              type="button"
              className="px-3.5 py-1.5 bg-[#103A20] hover:bg-[#1C5130] text-amber-300 border border-[#235E39] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="Back to Sauda Desk (Esc)"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4 text-amber-300" />
              <span>Back</span>
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={onOpenNewForm}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>New Inspection Form</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 bg-[#0b2415]/80 hover:bg-[#123920] active:scale-95 border border-emerald-400/50 rounded-lg text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 text-amber-300 ${loading ? "animate-spin" : ""}`} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
