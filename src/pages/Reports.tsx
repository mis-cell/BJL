import React from 'react';
import LegacyLayout from '../components/LegacyLayout';

export default function Reports({ onClose }: { onClose?: () => void; initialReportType?: string }) {
  return (
    <LegacyLayout title="System Reports" onClose={onClose}>
      <div className="w-full h-full min-h-[500px] bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center justify-center text-center space-y-4 font-sans my-2">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl shadow-sm">
          📊
        </div>
        <div className="max-w-md space-y-1">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
            System Reports
          </h2>
          <p className="text-xs text-slate-500">
            Blank System Reporting Feature. Ready for custom report implementation.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[10px] font-black uppercase font-mono tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>REPORT FEATURE READY</span>
        </div>
      </div>
    </LegacyLayout>
  );
}
