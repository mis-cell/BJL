import React, { useState, useEffect } from 'react';
import {
  FileText,
  TrendingUp,
  Truck,
  MapPin,
  Layers,
  Wallet,
  BarChart3,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';
import LegacyLayout from '../components/LegacyLayout';
import PurchaseOrderSummary from '../components/PurchaseOrderSummary';
import { PercentageWiseAnalyticsSection } from '../components/reports/PercentageWiseAnalyticsSection';
import { AmadReportView } from '../components/reports/AmadReportView';
import { SaudaDashboardView } from '../components/reports/SaudaDashboardView';
import { SaudaAdvancedReportsView } from '../components/reports/SaudaAdvancedReportsView';
import { MapWisePOView } from '../components/reports/MapWisePOView';
import { DataAggregationView } from '../components/reports/DataAggregationView';
import PaymentReport from '../components/PaymentReport';
import PaymentModule from './TredeReport';
import { dbModule } from '../services/dbModule';

export default function Reports({ onClose, initialReportType }: { onClose?: () => void; initialReportType?: string }) {
  const [reportType, setReportType] = useState<
    'po_summary' | 'sauda_analyze' | 'amad' | 'map_wise_po' | 'data_aggregation' | 'global_analytics' | 'payment_report' | 'trade'
  >(() => {
    if (initialReportType) {
      const clean = initialReportType.toLowerCase().replace('reports:', '').trim();
      if (clean === 'trade_report' || clean === 'trade') return 'trade';
      if (clean === 'payment_report' || clean === 'payment') return 'payment_report';
      if (clean === 'amad' || clean === 'temporary_arrival') return 'amad';
      if (
        clean === 'po_summary' ||
        clean === 'po' ||
        clean === 'sauda_check_point' ||
        clean === 'sauda_check' ||
        clean === 'saudacheckpoint'
      ) {
        return 'po_summary';
      }
      if (clean === 'map_wise_po' || clean === 'map_wise' || clean === 'map') return 'map_wise_po';
      if (clean === 'data_aggregation' || clean === 'data_agg') return 'data_aggregation';
      if (
        clean === 'sauda_analyze' ||
        clean === 'report1' ||
        clean === 'sauda' ||
        clean === 'analytics' ||
        clean === 'percentage_analytics'
      ) {
        return 'sauda_analyze';
      }
    }
    return 'po_summary';
  });

  useEffect(() => {
    if (initialReportType) {
      const clean = initialReportType.toLowerCase().replace('reports:', '').trim();
      if (clean === 'trade_report' || clean === 'trade') {
        setReportType('trade');
      } else if (clean === 'payment_report' || clean === 'payment') {
        setReportType('payment_report');
      } else if (clean === 'amad' || clean === 'temporary_arrival') {
        setReportType('amad');
      } else if (
        clean === 'po_summary' ||
        clean === 'po' ||
        clean === 'sauda_check_point' ||
        clean === 'sauda_check' ||
        clean === 'saudacheckpoint'
      ) {
        setReportType('po_summary');
      } else if (clean === 'map_wise_po' || clean === 'map_wise' || clean === 'map') {
        setReportType('map_wise_po');
      } else if (clean === 'data_aggregation' || clean === 'data_agg') {
        setReportType('data_aggregation');
      } else if (
        clean === 'sauda_analyze' ||
        clean === 'report1' ||
        clean === 'sauda' ||
        clean === 'analytics' ||
        clean === 'percentage_analytics'
      ) {
        setReportType('sauda_analyze');
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
        } else if (clean === 'payment_report' || clean === 'payment') {
          setReportType('payment_report');
        } else if (clean === 'amad' || clean === 'temporary_arrival') {
          setReportType('amad');
        } else if (
          clean === 'po_summary' ||
          clean === 'po' ||
          clean === 'sauda_check_point' ||
          clean === 'sauda_check' ||
          clean === 'saudacheckpoint'
        ) {
          setReportType('po_summary');
        } else if (clean === 'map_wise_po' || clean === 'map_wise' || clean === 'map') {
          setReportType('map_wise_po');
        } else if (clean === 'data_aggregation' || clean === 'data_agg') {
          setReportType('data_aggregation');
        } else if (
          clean === 'sauda_analyze' ||
          clean === 'report1' ||
          clean === 'sauda' ||
          clean === 'analytics' ||
          clean === 'percentage_analytics'
        ) {
          setReportType('sauda_analyze');
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
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 bg-emerald-950 border-2 border-emerald-900 rounded-xl shadow-md">
          {[
            {
              id: 'po_summary' as const,
              buttonId: 'tab-po-summary',
              label: 'Sauda Check Point',
              icon: FileText,
              badge: '10 Reports'
            },
            {
              id: 'sauda_analyze' as const,
              buttonId: 'tab-report1',
              label: 'Sauda Analytics',
              icon: TrendingUp,
              badge: 'Analytics'
            },
            {
              id: 'amad' as const,
              buttonId: 'tab-amad',
              label: 'Amad Register',
              icon: Truck,
              badge: `${amadData.length}`
            },
            {
              id: 'map_wise_po' as const,
              buttonId: 'tab-map-wise',
              label: 'MAP WISE P.O',
              icon: MapPin,
              badge: 'GIS'
            },
            {
              id: 'data_aggregation' as const,
              buttonId: 'tab-data-aggregation',
              label: 'Data Aggregation',
              icon: Layers,
              badge: 'Aggregator'
            },
            {
              id: 'payment_report' as const,
              buttonId: 'tab-payment',
              label: 'Payment Report',
              icon: Wallet,
              badge: 'Finance'
            },
            {
              id: 'trade' as const,
              buttonId: 'tab-trade',
              label: 'Trade Report',
              icon: BarChart3,
              badge: 'Trade'
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = reportType === tab.id;
            return (
              <button
                key={tab.id}
                id={tab.buttonId}
                onClick={() => setReportType(tab.id)}
                className={cn(
                  "px-3 sm:px-4 h-9 text-[11px] sm:text-xs font-black uppercase tracking-wide",
                  "rounded-lg border transition-all duration-150 shadow-sm flex items-center gap-2",
                  isActive
                    ? "bg-yellow-400 text-green-950 border-yellow-300 shadow-md shadow-yellow-500/30 scale-[1.02]"
                    : "bg-emerald-900 text-emerald-100 border-emerald-800 hover:bg-yellow-400 hover:text-green-950 hover:border-yellow-300"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-green-950" : "text-emerald-300")} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={cn(
                      "text-[8.5px] font-black px-1.5 py-0.5 rounded-full leading-none",
                      isActive
                        ? "bg-green-950 text-yellow-300"
                        : "bg-emerald-950 text-emerald-300"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* --- 1. SAUDA CHECK POINT (P.O SUMMARY) --- */}
        {reportType === 'po_summary' && (
          <div className="space-y-4" id="report-sauda-checkpoint-container">
            <PurchaseOrderSummary refreshTrigger={refreshTrigger} />
          </div>
        )}

        {/* --- 2. AMAD REGISTER VIEW --- */}
        {reportType === 'amad' && (
          <AmadReportView
            amadData={amadData}
            onRefresh={fetchAllData}
            loading={loading}
          />
        )}

        {/* --- 3. SAUDA ANALYZE (OUT) --- */}
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

        {/* --- 6. PAYMENT REPORT --- */}
        {reportType === 'payment_report' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-2 sm:p-4">
            <PaymentReport onClose={() => setReportType('po_summary')} />
          </div>
        )}

        {/* --- 7. TRADE REPORT --- */}
        {reportType === 'trade' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-2 sm:p-4">
            <PaymentModule onClose={() => setReportType('po_summary')} />
          </div>
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
