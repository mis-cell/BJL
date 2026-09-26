import React, { useState } from 'react';
import { 
  Mail, 
  User, 
  Lock, 
  LayoutDashboard, 
  BarChart3, 
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getCurrentUserContext } from '../lib/permissions';
import LegacyLayout from '../components/LegacyLayout';
import { supabase } from '../lib/supabase';
import MismatchCase from './MismatchCase';
import Reports from './Reports';
import ExecutiveBiDashboard from '../components/ExecutiveBiDashboard';

import { useDashboardData } from '../components/dashboard/useDashboardData';
import GodownCapacityModal from '../components/dashboard/GodownCapacityModal';
import SmsSaudaModal from '../components/dashboard/SmsSaudaModal';
import UserProfileModal from '../components/dashboard/UserProfileModal';
import DashboardProcessModules from '../components/dashboard/DashboardProcessModules';
import AnalyticalInsightsConsole from '../components/dashboard/AnalyticalInsightsConsole';
import { DashboardProps } from '../components/dashboard/types';

export default function Dashboard({ 
  onNavigate, 
  isAdmin, 
  allowedModules,
  currentTab: propCurrentTab,
  setCurrentTab: propSetCurrentTab,
  isActive = true
}: DashboardProps) {
  const [localCurrentTab, setLocalCurrentTab] = useState<'menu' | 'mismatch' | 'reports'>('menu');
  const currentTab = propCurrentTab !== undefined ? propCurrentTab : localCurrentTab;
  const setCurrentTab = propSetCurrentTab !== undefined ? propSetCurrentTab : setLocalCurrentTab;

  // Custom modals state
  const [isGodownModalOpen, setIsGodownModalOpen] = useState(false);
  const [isSmsSaudaModalOpen, setIsSmsSaudaModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showDetailedProcesses, setShowDetailedProcesses] = useState(false);
  const [showAnalyticalConsole, setShowAnalyticalConsole] = useState(false);

  // User Profile Data
  const [userProfileData, setUserProfileData] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [updatePasswordSuccess, setUpdatePasswordSuccess] = useState('');

  // Primary live data hook
  const {
    stats,
    godowns,
    godownUtils,
    emailHealthWarning,
    rawSaudas,
    rawPos,
    rawArrivals,
    rawFinalArrivals,
    rawScp,
    rawScpDetails,
    payments,
    paymentDetails,
    recentAmad,
    inspectionMasters,
    inspectionDetails,
    millIssueMasters,
    millIssueDetails,
    allOpeningStocks,
    stockNodeStocks,
    loading,
    quickReportData,
    loadStats,
    arrivalTrendsData,
    poDistributionData,
    settlementPieData,
    gradeStockLevelsData,
    gradeArrivalTrendsData
  } = useDashboardData(isActive);

  const loadUserProfile = async () => {
    try {
      if (!supabase) return;
      const username = getCurrentUserContext().username || "ADMIN";
      const { data, error } = await supabase
        .from('user_master')
        .select('*')
        .eq('username', username.toUpperCase())
        .single();
      if (!error && data) {
        setUserProfileData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !supabase) return;
    try {
      const username = getCurrentUserContext().username || "ADMIN";
      const { error } = await supabase
        .from('user_master')
        .update({ password: newPassword })
        .eq('username', username.toUpperCase());
      
      if (!error) {
        setUpdatePasswordSuccess('Password updated successfully!');
        setNewPassword('');
        setTimeout(() => setUpdatePasswordSuccess(''), 3000);
      } else {
        alert('Failed to update password');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <LegacyLayout 
      title="P.O Automation" 
      subtitle="Operational Hub"
      activeNavTab="dashboard"
      allowedModules={allowedModules}
      isAdmin={isAdmin}
      onNavClick={(pageId) => {
        if (pageId === 'dashboard') {
          setCurrentTab('menu');
        } else {
          onNavigate(pageId);
        }
      }}
    >
      <div className="space-y-6 max-w-full px-2 sm:px-4">
        
        {/* Navigation Tabs Bar */}
        <div className="hidden">
          <button
            onClick={() => setCurrentTab('menu')}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold",
              currentTab === 'menu'
                ? "bg-[#1E331B] border-[#1E331B] text-[#FAF7F0] shadow-sm"
                : "bg-[#FAF7F0] border-[#D6CAA8] text-[#5A6E54] hover:bg-[#EAE2D2] hover:text-[#1E331B]"
            )}
          >
            <LayoutDashboard className="h-4 w-4 text-emerald-400" />
            <span>Executive BI Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentTab('reports')}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold",
              currentTab === 'reports'
                ? "bg-[#1E331B] border-[#1E331B] text-[#FAF7F0] shadow-sm"
                : "bg-[#FAF7F0] border-[#D6CAA8] text-[#5A6E54] hover:bg-[#EAE2D2] hover:text-[#1E331B]"
            )}
          >
            <BarChart3 className="h-4 w-4 text-amber-400" />
            <span>Report Dashboard</span>
          </button>

          <button
            onClick={() => onNavigate('admindesk')}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold bg-[#EAE2D2] border-[#D6CAA8] text-[#1E331B] hover:bg-[#FAF7F0]"
            )}
          >
            <Lock className="h-4 w-4 text-[#1E331B]" />
            <span>Admin Desk</span>
          </button>
          
          {emailHealthWarning && (
            <div className="flex items-center gap-2 bg-rose-100 border border-rose-300 text-rose-800 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse shadow-sm ml-auto mr-2 cursor-help" title="The last 3 system emails failed to send. Check Email Activity in Admin Desk.">
              <Mail className="h-3 w-3" />
              SMTP Warning
            </div>
          )}

          <button
            onClick={() => {
              loadUserProfile();
              setIsProfileOpen(true);
            }}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold bg-[#FAF7F0] border-[#D6CAA8] text-[#1E331B] hover:bg-[#EAE2D2] ml-auto"
            )}
          >
            <User className="h-4 w-4 text-[#1E331B]" />
            <span>{getCurrentUserContext().username || "ADMIN"}</span>
          </button>
        </div>
        
        {/* Tab 1: Executive BI Dashboard */}
        {currentTab === 'menu' && (
          <ExecutiveBiDashboard
            arrivals={rawArrivals}
            saudas={rawSaudas}
            saudaCheckPoints={rawScp}
            saudaCheckPointDetails={rawScpDetails}
            traders={[]}
            pos={rawPos}
            settlements={[]}
            godowns={godowns}
            openingStocks={allOpeningStocks.length > 0 ? allOpeningStocks : stockNodeStocks}
            millIssueMasters={millIssueMasters}
            millIssueDetails={millIssueDetails}
            finalArrivals={rawFinalArrivals}
            paymentRecords={payments}
            paymentDetails={paymentDetails}
            inspections={inspectionMasters}
            inspectionDetails={inspectionDetails}
            loading={loading}
            onRefresh={loadStats}
            onNavigate={onNavigate}
            setcurrentTab={setCurrentTab}
            currentTab={currentTab}
            allowedModules={allowedModules}
            isAdmin={isAdmin}
          />
        )}

        {/* Tab 2: Discrepancy & Mismatch Case */}
        {currentTab === 'mismatch' && (
          <MismatchCase 
            onClose={() => setCurrentTab('menu')}
          />
        )}

        {/* Tab 3: Detailed Reports View */}
        {currentTab === 'reports' && (
          <Reports 
            onClose={() => setCurrentTab('menu')}
          />
        )}

        {/* Detailed Process Modules (Collapsible / Toggleable) */}
        {showDetailedProcesses && (
          <DashboardProcessModules
            isAdmin={isAdmin}
            allowedModules={allowedModules}
            onNavigate={onNavigate}
          />
        )}

        {/* Analytical Insights Console (Collapsible / Toggleable) */}
        {showAnalyticalConsole && (
          <AnalyticalInsightsConsole
            arrivalTrendsData={arrivalTrendsData}
            poDistributionData={poDistributionData}
            settlementPieData={settlementPieData}
            gradeArrivalTrendsData={gradeArrivalTrendsData}
            gradeStockLevelsData={gradeStockLevelsData}
            quickReportData={quickReportData}
            loadStats={loadStats}
            onNavigate={onNavigate}
            recentAmad={recentAmad}
          />
        )}

        {/* Godown Capacity Audited Breakdown Modal */}
        <GodownCapacityModal
          isOpen={isGodownModalOpen}
          onClose={() => setIsGodownModalOpen(false)}
          godownUtils={godownUtils}
          globalUtilization={stats.godownUtilization}
        />

        {/* SMS Sauda Contract Booking Register Modal */}
        <SmsSaudaModal
          isOpen={isSmsSaudaModalOpen}
          onClose={() => setIsSmsSaudaModalOpen(false)}
        />

        {/* User Profile Console Modal */}
        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userProfileData={userProfileData}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          updatePasswordSuccess={updatePasswordSuccess}
          onUpdatePassword={handleUpdatePassword}
        />

      </div>
    </LegacyLayout>
  );
}
export { default as StatCard } from '../components/dashboard/StatCard';
