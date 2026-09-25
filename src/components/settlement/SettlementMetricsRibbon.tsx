import React from "react";
import { Truck } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SettlementMetricsRibbonProps {
  poStats: {
    contractQty: number;
    receivedQty: number;
    settledQty: number;
    pendingQty: number;
    customReceivedQty: number;
    pendingReceivedQty: number;
    dbPendingReceived: number;
  } | null;
  selectedPoNo: string;
  lastSyncTime: string;
  inspections: any[];
  customSettlementRecords: any[];
}

export const SettlementMetricsRibbon: React.FC<SettlementMetricsRibbonProps> = ({
  poStats,
  selectedPoNo,
  lastSyncTime,
  inspections,
  customSettlementRecords,
}) => {
  if (!poStats) return null;

  const fulfillmentPercent = Math.min(
    100,
    Math.max(
      0,
      ((poStats.customReceivedQty + poStats.receivedQty) /
        (poStats.contractQty || 1)) *
        100
    )
  );

  return (
    <div className="space-y-2">
      {/* 1-to-N Fulfillment Progress Bar */}
      <div className="bg-slate-900 border-2 border-indigo-900 p-2.5 rounded-sm text-white space-y-1.5 shadow-md">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
          <span className="text-indigo-300 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-cyan-400 inline" />
            <span>1-to-N P.O Consignment Fulfillment Progress (PO #{selectedPoNo})</span>
          </span>
          <span className="text-emerald-400 font-mono text-xs font-bold">
            {fulfillmentPercent.toFixed(1)}% Fulfilled
          </span>
        </div>

        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
          <div
            className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 h-full transition-all duration-500"
            style={{ width: `${fulfillmentPercent}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[9px] text-slate-300 font-mono pt-0.5">
          <span>
            Contract: <strong className="text-white">{poStats.contractQty.toFixed(3)} MT</strong>
          </span>
          <span>
            Delivered (Inspection):{" "}
            <strong className="text-emerald-300">
              {(poStats.customReceivedQty + poStats.receivedQty).toFixed(3)} MT
            </strong>
          </span>
          <span>
            Pending Balance:{" "}
            <strong className="text-amber-300">{poStats.pendingReceivedQty.toFixed(3)} MT</strong>
          </span>
          <span className="text-cyan-300 font-bold">
            Linked Consignments: {inspections.filter((i) => i.po_no === selectedPoNo).length} Truckloads
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-3 border-2 border-slate-700 shadow-inner rounded-sm">
        <div className="border-r border-slate-700/50 pr-2">
          <p className="text-[8px] font-extrabold uppercase text-indigo-200 tracking-wider">Total PO Contract</p>
          <p className="text-xs font-mono font-black text-white">{poStats.contractQty.toFixed(3)} MT</p>
        </div>
        <div className="border-r border-slate-700/50 px-2">
          <p className="text-[8px] font-extrabold uppercase text-emerald-300 tracking-wider">Inspected Received</p>
          <p className="text-xs font-mono font-black text-emerald-400">{poStats.receivedQty.toFixed(3)} MT</p>
        </div>
        <div className="border-r border-slate-700/50 px-2">
          <p className="text-[8px] font-extrabold uppercase text-amber-300 tracking-wider">Settles Sum (Classic)</p>
          <p className="text-xs font-mono font-black text-amber-400">{poStats.settledQty.toFixed(3)} MT</p>
        </div>
        <div className="border-r border-slate-700/50 px-2 bg-slate-900/40 rounded-xs p-1">
          <p className="text-[8px] font-extrabold uppercase text-cyan-300 tracking-wider">M.R. Settlements Sum</p>
          <p className="text-xs font-mono font-black text-cyan-400">{poStats.customReceivedQty.toFixed(3)} MT</p>
        </div>
        <div className="pl-2 bg-indigo-900/40 rounded-xs p-1">
          <p className="text-[8px] font-extrabold uppercase text-pink-300 tracking-wider">Pending Received (Custom)</p>
          <p className="text-xs font-mono font-black text-pink-400 animate-pulse">{poStats.pendingReceivedQty.toFixed(3)} MT</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-[9px] bg-slate-950 border-x-2 border-b-2 border-slate-700/70 px-3 py-1.5 -mt-2 text-slate-350 font-mono italic rounded-b-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "font-extrabold tracking-tight flex items-center gap-1",
              Math.abs((poStats.dbPendingReceived || 0) - poStats.pendingReceivedQty) < 0.001
                ? "text-emerald-400 font-bold"
                : "text-amber-400"
            )}
          >
            ● DB-SYNC:{" "}
            {Math.abs((poStats.dbPendingReceived || 0) - poStats.pendingReceivedQty) < 0.001
              ? `VERIFIED (purchase_master.pending_received = ${poStats.dbPendingReceived.toFixed(3)} MT)`
              : `ACTIVE (Pending validation)`}
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Last DB Sync: <strong className="text-white font-bold font-sans not-italic">{lastSyncTime || "Pending Selection"}</strong>
          </span>
        </div>
        <div>
          <span>
            Cumulative Received Weight Summary:{" "}
            <strong className="text-cyan-400 font-bold not-italic font-sans text-xs">
              {(poStats.customReceivedQty + poStats.receivedQty).toFixed(3)} MT
            </strong>
          </span>
        </div>
      </div>

      {customSettlementRecords.length > 0 && (
        <div className="bg-[#f0ede6] p-2 border border-yellow-800/20 text-[10px] space-y-1">
          <p className="font-extrabold text-slate-800 uppercase text-[9px] tracking-wider text-rose-900 underline">
            Active P.O Settlements Log (m_r_settlement Table):
          </p>
          <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[9px]">
            {customSettlementRecords.map((r, i) => (
              <div key={r.id || i} className="flex justify-between border-b border-black/5 pb-1">
                <span>
                  Settle-Dt: {r.settlement_date ? r.settlement_date.split("T")[0] : "N/A"} - Quant:{" "}
                  <b className="text-indigo-900">{Number(r.quantity).toFixed(3)} MT</b>
                </span>
                <span className="text-gray-600 font-sans text-[8px]">
                  Scale Net: {Number(r.electronic_scale_net || 0).toFixed(3)} MT | Status:{" "}
                  <b className="uppercase font-sans font-black text-[8px]">{r.payment_status}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementMetricsRibbon;
