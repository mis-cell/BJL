import React, { useState } from 'react';
import { Container, Scale } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GodownUtil } from './types';

export interface GodownCapacityModalProps {
  isOpen: boolean;
  onClose: () => void;
  godownUtils: GodownUtil[];
  globalUtilization?: string;
}

export default function GodownCapacityModal({
  isOpen,
  onClose,
  godownUtils,
  globalUtilization = '0'
}: GodownCapacityModalProps) {
  const [selectedGodownIndex, setSelectedGodownIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const totalRegisteredCap = godownUtils.reduce((acc, g) => acc + g.capacity, 0);
  const totalPhysicalStockLive = godownUtils.reduce((acc, g) => acc + g.stockMt, 0);

  const handleClose = () => {
    setSelectedGodownIndex(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#d4d0c8] border-2 border-white shadow-[4px_4px_16px_rgba(0,0,0,0.45),inset_1.5px_1.5px_0px_white] w-full max-w-4xl flex flex-col rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[85vh]">
        
        {/* Title Bar Windows 95 style */}
        <div className="bg-[#000080] text-white px-2.5 py-1.5 flex justify-between items-center ">
          <div className="flex items-center gap-1.5 font-bold text-xs font-sans tracking-wide">
            <Container className="h-4 w-4 text-slate-200" />
            <span>GODOWN CAPACITY UTILIZATION SUMMARY REGISTER</span>
          </div>
          <button 
            onClick={handleClose}
            className="bg-[#d4d0c8] text-black px-1.5 py-0.5 border border-white hover:bg-red-650 hover:text-white transition-colors active:shadow-[inset_1px_1px_0_1px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer font-extrabold text-[10px]"
          >
            ✕
          </button>
        </div>

        {/* Upper Control Bar */}
        <div className="bg-[#c0c0c0] p-3 border-b border-gray-400 border border-black/25 flex justify-between items-center p-2 gap-2 flex-wrap">
          <div className="flex gap-4 flex-wrap">
            <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[110px]">
              <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Total Owned Nodes</span>
              <span className="text-[11px] font-black italic text-stone-850 tracking-tight">{godownUtils.length} Godowns</span>
            </div>
            <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[120px]">
              <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Total Registered Cap</span>
              <span className="text-[11px] font-black italic text-indigo-950 tracking-tight">
                {totalRegisteredCap.toLocaleString()} MT
              </span>
            </div>
            <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[130px]">
              <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Physical Stock Live</span>
              <span className="text-[11px] font-black italic text-emerald-950 tracking-tight">
                {totalPhysicalStockLive.toFixed(1)} MT
              </span>
            </div>
            <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[120px]">
              <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Global Utility Rate</span>
              <span className="text-[11px] font-black italic text-amber-600 tracking-tight">
                {globalUtilization || '0'}%
              </span>
            </div>
          </div>
          <div className="hidden md:block text-[9px] font-mono font-black italic text-indigo-950 pr-2 uppercase">Capacity Controls Center</div>
        </div>

        {/* Main Split Content Body */}
        <div className="flex-1 overflow-hidden flex bg-white divide-x divide-slate-300">
          
          {/* Left Side: Godown List */}
          <div className="w-1/2 overflow-y-auto p-2.5 space-y-2">
            <p className="text-[9px] font-black uppercase text-gray-400 tracking-wide mb-2.5">Select a Warehouse Row to audit:</p>
            
            <div className="space-y-1.5">
              {godownUtils.map((g, idx) => {
                const isSelected = selectedGodownIndex === idx;
                return (
                  <div 
                    key={idx}
                    onClick={() => setSelectedGodownIndex(idx)}
                    className={cn(
                      "p-2 py-2.5 border rounded transition-all cursor-pointer relative group",
                      isSelected 
                        ? "bg-slate-100 border-indigo-600 shadow-sm shadow-slate-150" 
                        : "border-slate-200 hover:border-slate-350 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <span className="text-[8px] font-black text-blue-800 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded mr-1.5 font-mono uppercase tracking-wider">
                          {g.code}
                        </span>
                        <strong className="text-xs uppercase font-extrabold text-slate-800">{g.name}</strong>
                      </div>
                      <span className={cn(
                        "text-[10px] font-black font-mono",
                        g.utilization > 80 ? "text-red-650" :
                        g.utilization > 50 ? "text-amber-600" : "text-emerald-700"
                      )}>
                        {g.utilization}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-sm h-1.5 mb-2 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-sm transition-all duration-300",
                          g.utilization > 80 ? "bg-red-500" :
                          g.utilization > 50 ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(100, g.utilization)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[8px] font-bold text-gray-500 font-mono">
                      <span>CAPACITY: {g.capacity} MT</span>
                      <span>STOCK: {g.stockMt.toFixed(1)} MT ({g.bales.toLocaleString()} Bales)</span>
                    </div>

                    <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 text-[7px] font-black uppercase text-indigo-700 tracking-wider transition-opacity ">
                      Inspect details →
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Detailed stock breakdown of selected Godown */}
          <div className="w-1/2 overflow-y-auto p-4 bg-slate-50/50 flex flex-col">
            {selectedGodownIndex !== null ? (
              (() => {
                const selG = godownUtils[selectedGodownIndex];
                return (
                  <div className="space-y-4">
                    <div className="border-b border-slate-200 pb-3">
                      <h4 className="text-xs font-black uppercase text-indigo-950 tracking-tight flex items-center gap-1.5">
                        <Scale className="h-4 w-4 text-indigo-800 shrink-0" />
                        RE-INSPECTION LEDGERS FOR GODOWN {selG.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-medium font-mono">Code Reference: <strong className="font-extrabold text-slate-700">GDN-{selG.code}</strong></p>
                    </div>

                    {/* Snapshot stats */}
                    <div className="grid grid-cols-2 gap-3 h-fit">
                      <div className="bg-white p-2.5 border border-slate-200 rounded shadow-xs shadow-inner">
                        <span className="text-[8px] font-black text-gray-400 block uppercase leading-none mb-1">RATED CAPACITY</span>
                        <strong className="text-stone-850 text-[11px] font-mono leading-none">{selG.capacity} MT</strong>
                      </div>
                      <div className="bg-white p-2.5 border border-slate-200 rounded shadow-xs shadow-inner">
                        <span className="text-[8px] font-black text-gray-400 block uppercase leading-none mb-1">LOADED STOCK</span>
                        <strong className="text-stone-850 text-[11px] font-mono leading-none">{selG.stockMt.toFixed(2)} MT</strong>
                      </div>
                    </div>

                    <div className="border border-slate-350 rounded bg-white overflow-x-auto shadow-sm">
                      <table className="w-full text-left text-[9px] border-collapse min-w-[450px]">
                        <thead className="bg-[#c0c0c0] border-b border-slate-400 uppercase text-slate-800 font-black italic font-mono size-fit">
                          <tr className="h-7 border-b border-[#808080]/30 text-[9px]">
                            <th className="px-3 border-r border-[#808080]/35 uppercase">Grade Component</th>
                            <th className="px-3 text-right border-r border-[#808080]/35 uppercase">Bales Qty</th>
                            <th className="px-3 text-right border-r border-[#808080]/35 uppercase">Weight (KG)</th>
                            <th className="px-3 text-right uppercase">Weight (MT)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-155 font-bold text-slate-800 font-mono">
                          {selG.stocks && selG.stocks.length > 0 ? (
                            selG.stocks.map((st: any, idx: number) => (
                              <tr key={idx} className="h-7 hover:bg-slate-50 text-[9px]">
                                <td className="px-3 border-r border-slate-100 font-bold">
                                  <span className="bg-indigo-50 border border-indigo-150 text-indigo-950 px-1 py-0.5 rounded text-[8px] font-black">
                                    {st.grade}
                                  </span>
                                </td>
                                <td className="px-3 text-right border-r border-slate-100 font-bold text-slate-700">{Number(st.quantity || 0).toLocaleString()}</td>
                                <td className="px-3 text-right border-r border-slate-100 font-bold text-emerald-800">{(Number(st.weight || 0) * 100).toLocaleString(undefined, {maximumFractionDigits: 0})} kg</td>
                                <td className="px-3 text-right font-bold text-blue-800">{(Number(st.weight || 0) / 10).toFixed(2)} MT</td>
                              </tr>
                            ))
                          ) : (
                            <tr className="h-20 bg-stone-50">
                              <td colSpan={4} className="text-center text-gray-400 italic">
                                No direct physical stock records found in opening_stock tables for this godown.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-amber-50 border border-amber-255 rounded p-2.5 shadow-sm font-sans">
                      <h5 className="text-[10px] font-black uppercase text-amber-800 mb-0.5">Capacity Auditing Notice</h5>
                      <p className="text-[9px] text-amber-900/90 leading-relaxed font-bold">
                        These stock metrics represent active inventory allocated securely inside this specific node directory. Always match against monthly physical floor counts before authorizing issues.
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-8 text-gray-400 ">
                <Container className="h-10 w-10 text-slate-300 stroke-[1.25] mb-2" />
                <h4 className="text-xs font-black text-slate-700 uppercase mb-1 font-sans">No Godown Selected</h4>
                <p className="text-[10px] max-w-xs text-gray-400 leading-snug font-sans font-medium">Click any godown row on the left panel catalog list to print or view active stock allocations and live weight metrics directly from the database.</p>
              </div>
            )}

          </div>

        </div>

        {/* Popup Footer */}
        <div className="bg-[#c0c0c0] p-2 border-t border-slate-400 flex justify-end gap-1.5 ">
          <button 
            onClick={handleClose}
            className="bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold uppercase tracking-wider text-[10px] px-6 h-7 border border-white shadow-[1px_1px_0_0_black] cursor-pointer"
          >
            Close Summary Dialog
          </button>
        </div>

      </div>
    </div>
  );
}
