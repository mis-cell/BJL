import React from 'react';
import { 
  Save, 
  X, 
  RefreshCw, 
  ClipboardCheck, 
  ArrowLeft 
} from 'lucide-react';
import LegacyLayout from '../components/LegacyLayout';
import { useFinalArrivalEntryLogic } from '../components/final-arrival/useFinalArrivalEntryLogic';
import { FinalArrivalEntryHeader } from '../components/final-arrival/FinalArrivalEntryHeader';
import { FinalArrivalGridTable } from '../components/final-arrival/FinalArrivalGridTable';
import { FinalArrivalWeighmentCard } from '../components/final-arrival/FinalArrivalWeighmentCard';

interface FinalArrivalEntryProps {
  onSave?: (d: any) => void;
  onCancel?: () => void;
  initialData?: any;
}

export default function FinalArrivalEntry({ onSave, onCancel, initialData }: FinalArrivalEntryProps) {
  const {
    loading,
    containerRef,
    formData,
    details,
    brokers,
    suppliers,
    areas,
    agencies,
    grades,
    markas,
    unitList,
    showPoDropdown,
    setShowPoDropdown,
    combinedPoOptions,
    handleInputChange,
    handleAreaChange,
    handleSelectPoOption,
    loadDetailsFromAmad,
    handleAddRow,
    handleDeleteRow,
    handleRowChange,
    handleSave,
    finalWeightDisplayValue,
    totalReceiptQuantity,
    totalChallanQuantity,
    totalNettoWeight
  } = useFinalArrivalEntryLogic({ initialData, onSave, onCancel });

  return (
    <LegacyLayout title="FINAL ARRIVAL" subtitle="MATERIAL RECEIVED WORKSTATION" onClose={onCancel} activeNavTab="final_mr">
      <div 
        ref={containerRef}
        className="bg-[#F9F5EC] text-slate-800 font-sans flex flex-col p-2 md:p-3 space-y-4 max-w-[1700px] w-full mx-auto select-text selection:bg-[#103A20] selection:text-white"
      >
        {/* 1. HERO BANNER HEADER - DEEP GREEN THEME */}
        <div className="bg-gradient-to-r from-[#174C2C] to-[#103A20] rounded-xl border border-[#0d301b] p-3.5 text-white shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#103A20] text-amber-300 flex items-center justify-center border border-[#235E39] shrink-0 shadow-xs">
              <ClipboardCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white tracking-wide flex items-center gap-2">
                Final Arrival
              </h2>
              <p className="text-[11px] text-emerald-200/90 font-medium mt-0.5">
                Enter final M.R details and receipt grid items
              </p>
            </div>
          </div>
          {/* Action Controls & Session Badge */}
          <div className="relative z-10 flex items-center gap-3">
            <button
              type="button"
              className="px-3.5 py-1.5 bg-[#103A20] hover:bg-[#1C5130] text-amber-300 border border-[#235E39] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="Back to Sauda Desk (Esc)"
              onClick={onCancel}
            >
              <ArrowLeft className="h-4 w-4 text-amber-300" />
              <span>Back</span>
            </button>
            <div className="bg-[#103A20] border border-[#235E39] px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
              <span className="text-emerald-200/80 font-medium">Session:</span>
              <span className="font-bold text-amber-300 font-mono text-xs">BJCL/2026-2027/</span>
            </div>
          </div>
        </div>

        {/* 2. MASTER FORM FIELDS CARD */}
        <FinalArrivalEntryHeader
          formData={formData}
          handleInputChange={handleInputChange}
          handleAreaChange={handleAreaChange}
          handleSelectPoOption={handleSelectPoOption}
          loadDetailsFromAmad={loadDetailsFromAmad}
          showPoDropdown={showPoDropdown}
          setShowPoDropdown={setShowPoDropdown}
          combinedPoOptions={combinedPoOptions}
          brokers={brokers}
          suppliers={suppliers}
          areas={areas}
          unitList={unitList}
        />

        {/* 3. RECEIPT GRADE DETAILS TABLE */}
        <FinalArrivalGridTable
          details={details}
          handleRowChange={handleRowChange}
          handleAddRow={handleAddRow}
          handleDeleteRow={handleDeleteRow}
          grades={grades}
          agencies={agencies}
          markas={markas}
          unitList={unitList}
          totalChallanQuantity={totalChallanQuantity}
          totalReceiptQuantity={totalReceiptQuantity}
          totalNettoWeight={totalNettoWeight}
        />

        {/* 4. WEIGHMENTS & RECONCILIATION CARD */}
        <FinalArrivalWeighmentCard
          formData={formData}
          handleInputChange={handleInputChange}
          finalWeightDisplayValue={finalWeightDisplayValue}
        />

        {/* 5. FOOTER ACTIONS */}
        <div className="bg-white rounded-xl border border-[#E6DDC8] shadow-xs p-3 flex justify-between items-center">
          <div className="text-[11px] text-slate-500 font-medium">
            <span className="font-bold text-slate-700">Ctrl + S</span> to Save | <span className="font-bold text-slate-700">Esc</span> to Cancel
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 bg-[#103A20] hover:bg-[#1C5130] disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Voucher...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-emerald-300" />
                  <span>Save Final M.R Voucher</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </LegacyLayout>
  );
}
