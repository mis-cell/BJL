import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { cn } from '../lib/utils';
import LegacyLayout from '../components/LegacyLayout';
import PurchaseOrderSummary from '../components/PurchaseOrderSummary';
import { PercentageWiseAnalyticsSection } from '../components/reports/PercentageWiseAnalyticsSection';
import { AmadReportView } from '../components/reports/AmadReportView';
import { SaudaDashboardView } from '../components/reports/SaudaDashboardView';
import { SaudaAdvancedReportsView } from '../components/reports/SaudaAdvancedReportsView';
import { MapWisePOView } from '../components/reports/MapWisePOView';
import { DataAggregationView } from '../components/reports/DataAggregationView';
import { dbModule } from '../services/dbModule';

export default function Reports({ onClose, initialReportType }: { onClose?: () => void; initialReportType?: string }) {
  const [reportType, setReportType] = useState<
    'amad' | 'sauda_analyze' | 'po_summary' | 'map_wise_po' | 'data_aggregation' | 'global_analytics' | 'payment_report' | 'trade'
  >(() => {
    if (initialReportType) {
      const clean = initialReportType.toLowerCase().replace('reports:', '').trim();
      if (clean === 'trade_report' || clean === 'trade') return 'trade';
      if (
        clean === 'sauda_analyze' ||
        clean === 'report1' ||
        clean === 'po_summary' ||
        clean === 'map_wise_po' ||
        clean === 'map_wise' ||
        clean === 'data_aggregation' ||
        clean === 'global_analytics' ||
        clean === 'payment_report' ||
        clean === 'amad'
      ) {
        return (clean === 'report1' ? 'sauda_analyze' : clean === 'map_wise' ? 'map_wise_po' : clean) as any;
      }
    }
    return 'sauda_analyze';
  });

  useEffect(() => {
    if (initialReportType) {
      const clean = initialReportType.toLowerCase().replace('reports:', '').trim();
      if (clean === 'trade_report' || clean === 'trade') {
        setReportType('trade');
      } else if (
        clean === 'sauda_analyze' ||
        clean === 'po_summary' ||
        clean === 'map_wise_po' ||
        clean === 'data_aggregation' ||
        clean === 'global_analytics' ||
        clean === 'payment_report' ||
        clean === 'amad'
      ) {
        setReportType(clean as any);
      }
    }
  }, [initialReportType]);

  useEffect(() => {
    const handleTabChange = (e: any) => {
      const tab = e.detail?.tab || e.detail?.reportType;
      if (tab) {
        const clean = String(tab).toLowerCase().replace('reports:', '').trim();
        if (clean === 'trade_report' || clean === 'trade') {
          setReportType('trade');
        } else if (
          clean === 'sauda_analyze' ||
          clean === 'po_summary' ||
          clean === 'map_wise_po' ||
          clean === 'data_aggregation' ||
          clean === 'global_analytics' ||
          clean === 'payment_report' ||
          clean === 'amad'
        ) {
          setReportType(clean as any);
        }
      }
    };
    window.addEventListener('reports-tab-change', handleTabChange);
    return () => window.removeEventListener('reports-tab-change', handleTabChange);
  }, []);

  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Datasets
  const [globalStats, setGlobalStats] = useState<Record<string, number>>({});
  const [amadData, setAmadData] = useState<any[]>([]);
  const [saudaData, setSaudaData] = useState<any[]>([]);
  const [poData, setPoData] = useState<any[]>([]);
  const [poDetails, setPoDetails] = useState<any[]>([]);
  const [agencyList, setAgencyList] = useState<any[]>([]);
  const [gradeList, setGradeList] = useState<any[]>([]);
  const [saudaDetails, setSaudaDetails] = useState<any[]>([]);
  const [finalArrivalData, setFinalArrivalData] = useState<any[]>([]);
  const [inspectionData, setInspectionData] = useState<any[]>([]);
  const [deductionData, setDeductionData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [scpData, setScpData] = useState<any[]>([]);

  // Sauda View Modes
  const [saudaViewMode, setSaudaViewMode] = useState<'percentage_analytics' | 'dashboard' | 'advanced_reports'>('percentage_analytics');

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        amad,
        saudas,
        pos,
        details,
        agencies,
        grades,
        sDetails,
        finalArrivals,
        inspections,
        deductions,
        payments,
        scp,
        payMaster
      ] = await Promise.all([
        dbModule.fetchAll('temporary_material_received').catch(() => []),
        dbModule.fetchAll('sauda_master').catch(() => []),
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('purchase_detail_master').catch(() => []),
        dbModule.fetchAll('agency_master').catch(() => []),
        dbModule.fetchAll('grade_master').catch(() => []),
        dbModule.fetchAll('sauda_quality_details').catch(() => []),
        dbModule.fetchAll('final_arrival').catch(() => []),
        dbModule.fetchAll('material_inspection').catch(() => []),
        dbModule.fetchAll('material_inspection_deductions').catch(() => []),
        dbModule.fetchAll('payment_records').catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => []),
        dbModule.fetchAll('payment_master').catch(() => [])
      ]);

      const parseDateMs = (val: any) => {
        if (!val) return 0;
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      // Sort datasets descending by date/created_at
      const sortedAmad = [...(amad || [])]
        .map((item: any) => {
          const tempNo = item.temporary_arrival_no || item.amad_no || item.arrival_no || item.mr_no || (item.amad_id ? String(item.amad_id).slice(0, 8) : '');
          return {
            ...item,
            temporary_arrival_no: tempNo,
            amad_no: tempNo
          };
        })
        .sort((a, b) => parseDateMs(b.date || b.created_at) - parseDateMs(a.date || a.created_at));
      const sortedSauda = [...(saudas || [])].sort((a, b) => parseDateMs(b.date || b.created_at) - parseDateMs(a.date || a.created_at));
      const sortedPo = [...(pos || [])].sort((a, b) => parseDateMs(b.po_date || b.created_at) - parseDateMs(a.po_date || a.created_at));

      setAmadData(sortedAmad);
      setSaudaData(sortedSauda);
      setPoData(sortedPo);
      setPoDetails(details || []);
      setAgencyList(agencies || []);
      setGradeList(grades || []);
      setSaudaDetails(sDetails || []);
      setFinalArrivalData(finalArrivals || []);
      setInspectionData(inspections || []);
      setDeductionData(deductions || []);
      setPaymentData([...(payments || []), ...(payMaster || [])]);
      setScpData(scp || []);

      // Global counts stats
      try {
        const tablesToCount = [
          'user_master',
          'sauda_master',
          'purchase_master',
          'temporary_material_received',
          'final_arrival',
          'material_inspection',
          'mill_issue_master',
          'requisitions',
          'department_master',
          'godown_master'
        ];
        const counts: Record<string, number> = {};
        await Promise.all(
          tablesToCount.map(async (table) => {
            try {
              const data = await dbModule.fetchAll(table);
              counts[table] = data ? data.length : 0;
            } catch {
              counts[table] = 0;
            }
          })
        );
        setGlobalStats(counts);
      } catch {}

      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('Error loading reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  return (
    <LegacyLayout title="Reports & Analytics" onClose={onClose}>
      <div className="space-y-4">
        {/* Module Selector win95 Tab styling */}
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 bg-green-900 border-2 border-green-950 rounded-xl">
          {/* Report1 (formerly Sauda Analyze) */}
          <button
            id="tab-report1"
            onClick={() => setReportType('sauda_analyze')}
            className={cn(
              "px-5 h-9 text-[11px] sm:text-xs font-black uppercase tracking-wide",
              "rounded-lg border transition-all duration-150 shadow-sm",
              reportType === 'sauda_analyze'
                ? "bg-yellow-400 text-green-950 border-yellow-300 shadow-md shadow-yellow-500/30 font-black scale-[1.02]"
                : "bg-green-950 text-green-100 border-green-800 hover:bg-yellow-400 hover:text-green-950 hover:border-yellow-300"
            )}
          >
            Report
          </button>

          {/* MAP WISE (formerly Map Wise P.O) */}
          <button
            id="tab-map-wise"
            onClick={() => setReportType('map_wise_po')}
            className={cn(
              "px-5 h-9 text-[11px] sm:text-xs font-black uppercase tracking-wide",
              "rounded-lg border transition-all duration-150 shadow-sm",
              reportType === 'map_wise_po'
                ? "bg-yellow-400 text-green-950 border-yellow-300 shadow-md shadow-yellow-500/30 font-black scale-[1.02]"
                : "bg-green-950 text-green-100 border-green-800 hover:bg-yellow-400 hover:text-green-950 hover:border-yellow-300"
            )}
          >
            MAP WISE
          </button>
        </div>

        {/* --- 1. AMAD REGISTER VIEW --- */}
        {reportType === 'amad' && (
          <AmadReportView
            amadData={amadData}
            onRefresh={fetchAllData}
            loading={loading}
          />
        )}

        {/* --- 2. SAUDA ANALYZE (OUT) --- */}
        {reportType === 'sauda_analyze' && (
          <div
            className="bg-gradient-to-br from-emerald-50 via-white to-green-50 border border-emerald-200 rounded-2xl shadow-lg p-3 sm:p-4 space-y-4"
            id="report-sauda-container"
          >
            {/* ==================== SUB NAVIGATION ==================== */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSaudaViewMode('percentage_analytics')}
                  className={cn(
                    "px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
                    "rounded-xl border transition-all duration-200",
                    "shadow-sm hover:shadow-md hover:-translate-y-[1px]",
                    saudaViewMode === 'percentage_analytics'
                      ? "bg-emerald-700 text-white border-emerald-800 shadow-emerald-200"
                      : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                  )}
                >
                  ⚡ Percentage-Wise Analytics
                </button>

                <button
                  onClick={() => setSaudaViewMode('dashboard')}
                  className={cn(
                    "px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
                    "rounded-xl border transition-all duration-200",
                    "shadow-sm hover:shadow-md hover:-translate-y-[1px]",
                    saudaViewMode === 'dashboard'
                      ? "bg-emerald-700 text-white border-emerald-800 shadow-emerald-200"
                      : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                  )}
                >
                  📊 Sauda Overview
                </button>

                <button
                  onClick={() => setSaudaViewMode('advanced_reports')}
                  className={cn(
                    "px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
                    "rounded-xl border transition-all duration-200",
                    "shadow-sm hover:shadow-md hover:-translate-y-[1px]",
                    saudaViewMode === 'advanced_reports'
                      ? "bg-emerald-700 text-white border-emerald-800 shadow-emerald-200"
                      : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                  )}
                >
                  📋 Legacy 10-Reports Deck
                </button>
              </div>

              <span className="text-[9px] font-black text-emerald-800 uppercase tracking-[0.18em] font-mono">
                JUTE MIS • PERCENTAGE-WISE ANALYTICS ENGINE
              </span>
            </div>

            {/* Sub-Views */}
            {saudaViewMode === 'percentage_analytics' && (
              <PercentageWiseAnalyticsSection
                saudaData={saudaData}
                poData={poData}
                poDetails={poDetails}
                mrData={finalArrivalData}
                tempMRData={amadData}
                paymentData={paymentData}
                scpData={scpData}
              />
            )}

            {saudaViewMode === 'dashboard' && (
              <SaudaDashboardView saudaData={saudaData} />
            )}

            {saudaViewMode === 'advanced_reports' && (
              <SaudaAdvancedReportsView
                saudaData={saudaData}
                saudaDetails={saudaDetails}
              />
            )}
          </div>
        )}

        {/* --- 3. PO SUMMARY --- */}
        {reportType === 'po_summary' && (
          <div className="bg-emerald-800 border-2 border-emerald-950 shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] p-4 rounded-sm">
            <PurchaseOrderSummary refreshTrigger={refreshTrigger} />
          </div>
        )}

        {/* --- 4. MAP WISE P.O --- */}
        {reportType === 'map_wise_po' && (
          <MapWisePOView
            poData={poData}
            poDetails={poDetails}
            agencyList={agencyList}
            gradeList={gradeList}
          />
        )}

        {/* --- 5. DATA AGGREGATION --- */}
        {reportType === 'data_aggregation' && (
          <DataAggregationView
            poData={poData}
            saudaData={saudaData}
            poDetails={poDetails}
          />
        )}

        {/* Bottom Status Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-1 text-gray-500 border-t border-gray-300 mt-2">
          <div className="flex items-center gap-3">
            <History className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-[9px] font-bold uppercase tracking-widest italic leading-none text-gray-500">
              Live Connection Stable // Operational Control Console Enabled // Database Realtime Sourced
            </span>
          </div>

          <span className="text-[9.5px] font-black italic text-indigo-700 bg-white/60 px-2 py-0.5 border border-slate-300 uppercase shrink-0 font-mono">
            ERP REQ PORTLET: SECURE
          </span>
        </div>
      </div>
    </LegacyLayout>
  );
}
