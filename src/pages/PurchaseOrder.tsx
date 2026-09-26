import React, { useState, useRef } from 'react';
import LegacyLayout from '../components/LegacyLayout';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { canEditOrDelete } from '../lib/permissions';
import { checkIsAdvancePaymentDone, checkIsSettlementDone } from '../services/purchaseOrderAuthService';
import ExcessShortSettlementModal from '../components/ExcessShortSettlementModal';
import { PurchaseOrderRegisterView } from '../components/purchase-order/PurchaseOrderRegisterView';
import { PurchaseOrderFormView } from '../components/purchase-order/PurchaseOrderFormView';
import { PurchaseOrderPrintPortal } from '../components/purchase-order/PurchaseOrderPrintPortal';
import { usePurchaseOrderData } from '../components/purchase-order/usePurchaseOrderData';
import { usePurchaseOrderSorting } from '../components/purchase-order/usePurchaseOrderSorting';
import { usePurchaseOrderFormLogic } from '../components/purchase-order/usePurchaseOrderFormLogic';
import { usePurchaseOrderOperations } from '../components/purchase-order/usePurchaseOrderOperations';
import {
  PoActionMenuPortal,
  PoEmailToastNotification,
  GlobalConfirmModal,
  ReopenSuccessModal,
  ReopenAuditLogModal,
  MismatchApprovalModal
} from '../components/purchase-order/PurchaseOrderModals';
import { PoConsignmentModal } from '../components/purchase-order/PoConsignmentModal';
import { PoReopenModal } from '../components/purchase-order/PoReopenModal';

interface PurchaseOrderProps {
  onClose?: () => void;
  selectedYear?: string;
  isTempPo?: boolean;
  finalStage?: boolean;
  isArchiveView?: boolean;
}

export default function PurchaseOrder({
  onClose,
  selectedYear,
  isTempPo = false,
  finalStage = false,
  isArchiveView = false
}: PurchaseOrderProps) {
  const [viewMode, setViewMode] = useState<'register' | 'form'>('register');
  const poFormRef = useRef<HTMLDivElement | null>(null);

  // 1. Data Loading & Synchronization Hook
  const {
    MASTER_TABLE,
    DETAIL_TABLE,
    loading: dataLoading,
    setLoading: setDataLoading,
    poList,
    setPoList,
    brokerList,
    supplierList,
    areaList,
    saudaList,
    gradeList,
    markaList,
    agencyList,
    unitList,
    sattaBaseRates,
    sattaCalculatedRates,
    sattaDifferentials,
    allScpDetails,
    sattaCalcs,
    sattaBases,
    allTempArrivals,
    allFinalArrivals,
    allInspections,
    allPayments,
    allSettlements,
    settledDeductions,
    matchResults,
    dbMaterialMismatches,
    dbSattaMismatches,
    tempPoNoSet,
    fetchPosAndMasters,
    handleCsvDownload: triggerCsvDownload,
    isPoMismatchResolved
  } = usePurchaseOrderData({
    isTempPo,
    isArchiveView,
    selectedYear
  });

  // 2. Sorting & Register Filter Metrics Hook
  const {
    searchTerm,
    setSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    statusFilter,
    setStatusFilter,
    selectedPoNo,
    setSelectedPoNo,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortConfig,
    handleSort,
    renderSortIndicator,
    filteredPos,
    sortedPos,
    sectionPos,
    scopedPos,
    totalCompletedPos,
    totalShortPos,
    totalExcessPos,
    totalPendingPos,
    totalGeneratedPos,
    cumulativeWeight,
    statusPieData,
    STATUS_COLORS
  } = usePurchaseOrderSorting({
    poList,
    isArchiveView,
    matchResults,
    dbMaterialMismatches,
    isPoMismatchResolved
  });

  // 3. PO Form Data & Calculation Logic Hook
  const {
    todayStr,
    getCropYear,
    loading: formLoading,
    setLoading: setFormLoading,
    isCalcOpen,
    setIsCalcOpen,
    selectedItemSrl,
    setSelectedItemSrl,
    formData,
    setFormData,
    calcData,
    setCalcData,
    lookupSattaBaseRate,
    getSattaRateForRow,
    recalculateAllRates,
    recalculateItemWeights,
    handlePurchaseUnitChange,
    handleSaudaSelect,
    handleAddItem,
    handleDeleteItem,
    handleSyncFromSource,
    generateNextPtfNo,
    handleGlobalAdd,
    handleLoadSelectedPo,
    handleGlobalAmend,
    handleCalculateOk,
    handleSave,
    isSaudaActive,
    displaySaudas
  } = usePurchaseOrderFormLogic({
    isTempPo,
    isArchiveView,
    selectedYear,
    MASTER_TABLE,
    DETAIL_TABLE,
    poList,
    setPoList,
    brokerList,
    supplierList,
    areaList,
    saudaList,
    gradeList,
    markaList,
    agencyList,
    sattaBaseRates,
    sattaCalculatedRates,
    sattaDifferentials,
    allFinalArrivals,
    matchResults,
    isPoMismatchResolved,
    fetchPosAndMasters,
    setViewMode,
    setSelectedPoNo,
    setEmailNotification: (notif) => setEmailNotification(notif)
  });

  // 4. Operational Actions Hook
  const {
    printingPo,
    setPrintingPo,
    emailSendingStatus,
    emailNotification,
    setEmailNotification,
    closedNoticePo,
    setClosedNoticePo,
    reopenAuthModalPo,
    setReopenAuthModalPo,
    reopenUsername,
    setReopenUsername,
    reopenPassword,
    setReopenPassword,
    reopenRemarks,
    setReopenRemarks,
    reopenError,
    setReopenError,
    isReopening,
    showReopenPassword,
    setShowReopenPassword,
    reopenSuccessInfo,
    setReopenSuccessInfo,
    auditViewPo,
    setAuditViewPo,
    consignmentLedgerPo,
    setConsignmentLedgerPo,
    excessShortModalPo,
    setExcessShortModalPo,
    mismatchModalPo,
    setMismatchModalPo,
    actionMenu,
    setActionMenu,
    confirmState,
    setConfirmState,
    handleSendMailPo,
    handleDeletePo,
    handleApproveMismatch,
    openReopenAuthModal,
    executeReopenSauda,
    handleCloseSauda,
    handlePassToFinal,
    handlePrintPo,
    handleDownloadPoPdf,
    getMismatchReasonText
  } = usePurchaseOrderOperations({
    isTempPo,
    MASTER_TABLE,
    DETAIL_TABLE,
    poList,
    setPoList,
    brokerList,
    gradeList,
    agencyList,
    markaList,
    allPayments,
    allSettlements,
    fetchPosAndMasters,
    isPoMismatchResolved,
    handleGlobalAdd,
    setSelectedPoNo,
    todayStr
  });

  const loading = dataLoading || formLoading;

  // Keyboard navigation for form saving
  useKeyboardNavigation(poFormRef as React.RefObject<HTMLDivElement>, () => {
    if (viewMode === 'form') {
      handleSave();
    }
  });

  // Export CSV helper
  const handleCsvDownload = () => {
    const listToExport = scopedPos.length > 0 ? scopedPos : (sectionPos.length > 0 ? sectionPos : poList);
    triggerCsvDownload(listToExport);
  };

  // Full Screen Print Viewer Modal Overlay
  if (printingPo) {
    return (
      <PurchaseOrderPrintPortal
        printingPo={printingPo}
        onClose={() => setPrintingPo(null)}
        onDownloadPdf={handleDownloadPoPdf}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col text-[11px] text-slate-900 font-sans">
      {/* 1. Register Table View */}
      {viewMode === 'register' && (
        <LegacyLayout 
          title={isArchiveView ? "FINAL P.O ARCHIVE" : (isTempPo ? "SAUDA CHECK POINT" : "FINAL P.O")} 
          subtitle={isArchiveView ? "Archived & Settled Purchase Orders Register" : ""} 
          onClose={onClose}
        >
          <PurchaseOrderRegisterView
            isArchiveView={isArchiveView}
            isTempPo={isTempPo}
            onClose={onClose}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            totalPendingPos={totalPendingPos}
            totalGeneratedPos={totalGeneratedPos}
            totalCompletedPos={totalCompletedPos}
            totalShortPos={totalShortPos}
            totalExcessPos={totalExcessPos}
            cumulativeWeight={cumulativeWeight}
            statusPieData={statusPieData}
            STATUS_COLORS={STATUS_COLORS}
            scopedPos={scopedPos}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            handleCsvDownload={handleCsvDownload}
            fetchPosAndMasters={fetchPosAndMasters}
            loading={loading}
            handleGlobalAdd={handleGlobalAdd}
            selectedPoNo={selectedPoNo || ''}
            setSelectedPoNo={setSelectedPoNo}
            poList={poList}
            handlePrintPo={handlePrintPo}
            handleDeletePo={handleDeletePo}
            handleSort={handleSort as any}
            renderSortIndicator={renderSortIndicator as any}
            sortedPos={sortedPos}
            filteredPos={filteredPos}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            handleLoadSelectedPo={handleLoadSelectedPo}
            isPoMismatchResolved={isPoMismatchResolved}
            setClosedNoticePo={setClosedNoticePo}
            openReopenAuthModal={openReopenAuthModal}
            setAuditViewPo={setAuditViewPo}
            handleCloseSauda={handleCloseSauda}
            allPayments={allPayments}
            allSettlements={allSettlements}
            checkIsAdvancePaymentDone={checkIsAdvancePaymentDone}
            checkIsSettlementDone={checkIsSettlementDone}
            setExcessShortModalPo={setExcessShortModalPo}
            handlePassToFinal={handlePassToFinal}
            actionMenu={actionMenu}
            setActionMenu={setActionMenu}
            canEditOrDelete={canEditOrDelete}
            sattaBaseRates={sattaBases && sattaBases.length > 0 ? sattaBases : sattaBaseRates}
            allTempArrivals={allTempArrivals}
          />
        </LegacyLayout>
      )}

      {/* 2. In-Body Form Mode */}
      {viewMode === 'form' && (
        <PurchaseOrderFormView
          isArchiveView={isArchiveView}
          isTempPo={isTempPo}
          formData={formData}
          setFormData={setFormData}
          calcData={calcData}
          setCalcData={setCalcData}
          isCalcOpen={isCalcOpen}
          setIsCalcOpen={setIsCalcOpen}
          selectedItemSrl={selectedItemSrl}
          setSelectedItemSrl={setSelectedItemSrl}
          isSaudaActive={isSaudaActive}
          poList={poList}
          brokerList={brokerList}
          supplierList={supplierList}
          areaList={areaList}
          unitList={unitList}
          displaySaudas={displaySaudas}
          gradeList={gradeList}
          agencyList={agencyList}
          markaList={markaList}
          sattaBaseRates={sattaBaseRates}
          sattaCalculatedRates={sattaCalculatedRates}
          sattaDifferentials={sattaDifferentials}
          loading={loading}
          getCropYear={getCropYear}
          generateNextPtfNo={generateNextPtfNo}
          recalculateAllRates={recalculateAllRates}
          lookupSattaBaseRate={lookupSattaBaseRate}
          getSattaRateForRow={getSattaRateForRow}
          handlePurchaseUnitChange={handlePurchaseUnitChange}
          handleSaudaSelect={handleSaudaSelect}
          handleAddItem={handleAddItem}
          handleDeleteItem={handleDeleteItem}
          handleSyncFromSource={handleSyncFromSource}
          handleCalculateOk={handleCalculateOk}
          handleSave={handleSave}
          handleGlobalAmend={handleGlobalAmend}
          setViewMode={setViewMode}
          poFormRef={poFormRef}
        />
      )}

      {/* Actions dropdown */}
      <PoActionMenuPortal
        actionMenu={actionMenu}
        onClose={() => setActionMenu(null)}
        onSendMail={handleSendMailPo}
        onDelete={handleDeletePo}
      />

      {/* Floating Email & Action Notification Toast */}
      <PoEmailToastNotification
        notification={emailNotification}
        onClose={() => setEmailNotification(null)}
      />

      {/* Confirm popup */}
      <GlobalConfirmModal
        confirmState={confirmState}
        onDismiss={() => setConfirmState(null)}
      />

      {/* Excess / Short Deduction Settlement Modal */}
      {excessShortModalPo && (
        <ExcessShortSettlementModal
          po={excessShortModalPo}
          onClose={() => setExcessShortModalPo(null)}
          onSaveSuccess={() => { fetchPosAndMasters(); }}
          allFinalArrivals={allFinalArrivals}
          allTempArrivals={allTempArrivals}
          allScpDetails={allScpDetails}
          sattaCalculatedRates={sattaCalcs}
          sattaBaseRates={sattaBases}
        />
      )}

      {/* 1-to-N Consignment Ledger Modal */}
      {consignmentLedgerPo && (
        <PoConsignmentModal
          po={consignmentLedgerPo}
          onClose={() => setConsignmentLedgerPo(null)}
          allTempArrivals={allTempArrivals}
          allFinalArrivals={allFinalArrivals}
          allInspections={allInspections}
        />
      )}

      {/* Reopen Sauda Modal */}
      <PoReopenModal
        closedNoticePo={closedNoticePo}
        setClosedNoticePo={setClosedNoticePo}
        reopenAuthModalPo={reopenAuthModalPo}
        setReopenAuthModalPo={setReopenAuthModalPo}
        openReopenAuthModal={openReopenAuthModal}
        reopenUsername={reopenUsername}
        setReopenUsername={setReopenUsername}
        reopenPassword={reopenPassword}
        setReopenPassword={setReopenPassword}
        reopenRemarks={reopenRemarks}
        setReopenRemarks={setReopenRemarks}
        showReopenPassword={showReopenPassword}
        setShowReopenPassword={setShowReopenPassword}
        reopenError={reopenError}
        isReopening={isReopening}
        executeReopenSauda={executeReopenSauda}
      />

      {/* Reopen Success Modal */}
      <ReopenSuccessModal
        info={reopenSuccessInfo}
        onClose={() => setReopenSuccessInfo(null)}
        onEditNow={(po) => handleLoadSelectedPo(po)}
      />

      {/* Reopen Audit Log View Modal */}
      <ReopenAuditLogModal
        auditViewPo={auditViewPo}
        onClose={() => setAuditViewPo(null)}
      />

      {/* Mismatch Approval / Resolution Modal */}
      <MismatchApprovalModal
        mismatchModalPo={mismatchModalPo}
        onClose={() => setMismatchModalPo(null)}
        getMismatchReasonText={(item) => getMismatchReasonText(item, matchResults)}
        onApprove={handleApproveMismatch}
      />
    </div>
  );
}
