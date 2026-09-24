import React from 'react';
import { X, Check } from 'lucide-react';
import { PoCalcData } from '../../types/purchaseOrder';

interface PoCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  calcData: PoCalcData;
  setCalcData: React.Dispatch<React.SetStateAction<PoCalcData>>;
  isPtf: boolean;
  purchaseUnitName: string;
}

export const PoCalculationModal: React.FC<PoCalculationModalProps> = ({
  isOpen,
  onClose,
  onApply,
  calcData,
  setCalcData,
  isPtf,
  purchaseUnitName
}) => {
  if (!isOpen) return null;

  const isDrums = (purchaseUnitName || '').toUpperCase() === 'DRUMS';
  const unitWt = isDrums ? 50 : 147.5;

  const handleLorriesChange = (val: string) => {
    if (isPtf) {
      setCalcData(prev => ({ ...prev, total_lorries: val }));
      return;
    }
    const lorries = parseFloat(val) || 0;
    const totUnits = parseFloat(calcData.total_units) || 0;

    if (lorries > 0 && totUnits > 0) {
      const unitsPerLorry = totUnits / lorries;
      const unitsPerLorryStr = Number.isInteger(unitsPerLorry) ? unitsPerLorry.toString() : unitsPerLorry.toFixed(2);
      setCalcData(prev => ({ 
        ...prev, 
        total_lorries: val,
        units_per_lorry: unitsPerLorryStr
      }));
    } else if (lorries > 0 && totUnits === 0 && parseFloat(calcData.weight_per_lorry) > 0) {
      const wtMt = parseFloat(calcData.weight_per_lorry) || 0;
      const calcTot = Math.round((wtMt * 1000) / unitWt);
      const unitsPerLorry = calcTot / lorries;
      const unitsPerLorryStr = Number.isInteger(unitsPerLorry) ? unitsPerLorry.toString() : unitsPerLorry.toFixed(2);
      setCalcData(prev => ({ 
        ...prev, 
        total_lorries: val,
        total_units: calcTot.toString(),
        units_per_lorry: unitsPerLorryStr
      }));
    } else {
      setCalcData(prev => ({ ...prev, total_lorries: val }));
    }
  };

  const handleUnitsPerLorryChange = (val: string) => {
    if (isPtf) {
      setCalcData(prev => ({ ...prev, units_per_lorry: val }));
      return;
    }
    const unitsPerLorry = parseFloat(val) || 0;
    const lorries = parseFloat(calcData.total_lorries) || 0;

    if (lorries > 0 && unitsPerLorry > 0) {
      const totUnits = Math.round(lorries * unitsPerLorry);
      const wtMt = ((totUnits * unitWt) / 1000).toFixed(3);
      setCalcData(prev => ({ 
        ...prev, 
        units_per_lorry: val,
        total_units: totUnits.toString(),
        weight_per_lorry: wtMt
      }));
    } else {
      setCalcData(prev => ({ ...prev, units_per_lorry: val }));
    }
  };

  const handleTotalUnitsChange = (val: string) => {
    if (isPtf) {
      setCalcData(prev => ({ ...prev, total_units: val }));
      return;
    }
    const totUnits = parseFloat(val) || 0;
    const lorries = parseFloat(calcData.total_lorries) || 0;

    if (totUnits > 0) {
      const unitsPerLorry = lorries > 0 ? (totUnits / lorries) : totUnits;
      const unitsPerLorryStr = Number.isInteger(unitsPerLorry) ? unitsPerLorry.toString() : unitsPerLorry.toFixed(2);
      const wtMt = ((totUnits * unitWt) / 1000).toFixed(3);
      setCalcData(prev => ({ 
        ...prev, 
        total_units: val,
        units_per_lorry: unitsPerLorryStr,
        weight_per_lorry: wtMt
      }));
    } else {
      setCalcData(prev => ({ ...prev, total_units: val }));
    }
  };

  const handleWeightPerLorryChange = (val: string) => {
    if (isPtf) {
      setCalcData(prev => ({ ...prev, weight_per_lorry: val }));
      return;
    }
    const wtMt = parseFloat(val) || 0;
    const lorries = parseFloat(calcData.total_lorries) || 1;

    if (wtMt > 0) {
      const totUnits = Math.round((wtMt * 1000) / unitWt);
      const unitsPerLorry = lorries > 0 ? (totUnits / lorries) : totUnits;
      const unitsPerLorryStr = Number.isInteger(unitsPerLorry) ? unitsPerLorry.toString() : unitsPerLorry.toFixed(2);
      setCalcData(prev => ({ 
        ...prev, 
        weight_per_lorry: val,
        total_units: totUnits.toString(),
        units_per_lorry: unitsPerLorryStr
      }));
    } else {
      setCalcData(prev => ({ ...prev, weight_per_lorry: val }));
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-gray-600 border-b-gray-600 shadow-2xl w-full max-w-md p-4 text-xs font-sans text-black">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-3 py-1.5 font-bold mb-4">
          <span>Calculate Contract Units & MT helper</span>
          <button 
            type="button"
            onClick={onClose} 
            className="text-white hover:text-rose-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 px-2">
          <div className="flex items-center justify-between">
            <label className="font-bold">Total No. of Lorries:</label>
            <input 
              type="number"
              step="any"
              value={calcData.total_lorries}
              onChange={(e) => handleLorriesChange(e.target.value)}
              className="w-32 bg-white border border-gray-400 p-1 font-mono font-bold text-right"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="font-bold">Units / Lorry:</label>
            <input 
              type="number"
              step="any"
              value={calcData.units_per_lorry}
              onChange={(e) => handleUnitsPerLorryChange(e.target.value)}
              className="w-32 bg-white border border-gray-400 p-1 font-mono font-bold text-right"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="font-bold">Total Units:</label>
            <input 
              type="number"
              step="any"
              value={calcData.total_units}
              onChange={(e) => handleTotalUnitsChange(e.target.value)}
              className="w-32 bg-white border border-gray-400 p-1 font-mono font-bold text-right"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="font-bold">Weight / Lorry (M.Ton):</label>
            <input 
              type="number"
              step="any"
              value={calcData.weight_per_lorry}
              onChange={(e) => handleWeightPerLorryChange(e.target.value)}
              className="w-32 bg-white border border-gray-400 p-1 font-mono font-bold text-right"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-gray-400">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 border border-slate-400 hover:bg-slate-300 font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={onApply}
            className="px-4 py-1.5 bg-emerald-700 text-white hover:bg-emerald-800 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Check className="w-3.5 h-3.5" /> Apply Values
          </button>
        </div>
      </div>
    </div>
  );
};
