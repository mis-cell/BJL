import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Scale, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  trend?: string;
  color?: string;
  onClick?: () => void;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'text-indigo-950',
  onClick
}: StatCardProps) {
  const isInteractive = !!onClick;
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-200 p-4 shadow-sm relative group rounded-2xl overflow-hidden flex flex-col justify-between min-h-[100px]",
        isInteractive ? "cursor-pointer hover:border-indigo-400 hover:shadow-md hover:bg-indigo-50/20 transition-all active:scale-[0.98]" : ""
      )}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
        <Icon className="h-16 w-16" />
      </div>
      <div className="flex justify-between items-start mb-3 z-10">
         <div className="p-2 bg-indigo-50/80 border border-indigo-100/50 rounded-xl shadow-inner">
            <Icon className="h-5 w-5 text-indigo-600" />
         </div>
         {trend && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm border",
              trend.includes('+') ? "text-emerald-700 bg-emerald-50/80 border-emerald-200" :
              trend.includes('-') ? "text-rose-700 bg-rose-50/80 border-rose-200" : "text-indigo-700 bg-indigo-50/80 border-indigo-200"
            )}>
               {trend.includes('+') ? <ArrowUpRight className="h-3 w-3" /> : 
                trend.includes('-') ? <ArrowDownRight className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
               {trend}
            </span>
         )}
      </div>
      <div className="space-y-1 z-10 mt-auto">
        <h3 className="text-[11px] uppercase font-extrabold text-slate-500 tracking-widest">
          {label}
        </h3>
        <div className={cn("text-2xl font-black tabular-nums tracking-tight", color)}>
          {value}
        </div>
      </div>
      {isInteractive && (
         <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight className="h-4 w-4 text-indigo-600" />
         </div>
      )}
    </div>
  );
}
