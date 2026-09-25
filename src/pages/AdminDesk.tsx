import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogEntry } from '../components/admin-desk/adminDeskTypes';
import { useAdminDeskData } from '../components/admin-desk/useAdminDeskData';
import { useAdminDeskLogs } from '../components/admin-desk/useAdminDeskLogs';
import { AdminDeskLoginModal } from '../components/admin-desk/AdminDeskLoginModal';
import { AdminDeskRowEditorModal } from '../components/admin-desk/AdminDeskRowEditorModal';
import { AdminDeskPrintPreviewModal } from '../components/admin-desk/AdminDeskPrintPreviewModal';
import { AdminDeskMaterialLayout } from '../components/admin-desk/AdminDeskMaterialLayout';
import { AdminDeskClassicLayout } from '../components/admin-desk/AdminDeskClassicLayout';

interface AdminDeskProps {
  isAdmin?: boolean;
  systemLogs?: LogEntry[];
  onClearLogs?: () => void;
  onClose?: () => void;
  onLogin?: () => void;
  onNavigate?: (page: any) => Promise<any>;
}

export default function AdminDesk({
  isAdmin = false,
  systemLogs = [],
  onClearLogs,
  onClose
}: AdminDeskProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(isAdmin);
  const [useMaterialTheme, setUseMaterialTheme] = useState(false);
  const [activeSchemaTab, setActiveSchemaTab] = useState<'row' | 'column' | 'sql' | 'event_log' | 'reconciliation_log'>('row');
  const [activeMaterialPage, setActiveMaterialPage] = useState<string>('db_console');

  // Reconciliation Audit Logs
  const [reconRecords, setReconRecords] = useState<any[]>([]);
  const [selectedReconId, setSelectedReconId] = useState<string>('');
  const [reconLoading, setReconLoading] = useState(false);

  useEffect(() => {
    if (activeSchemaTab === 'reconciliation_log') {
      const loadReconRecords = async () => {
        setReconLoading(true);
        try {
          if (supabase) {
            const { data } = await supabase.from('final_arrival').select('*').limit(50);
            setReconRecords(data || []);
          }
        } catch (e) {
          console.warn('Failed to load reconciliation records:', e);
        } finally {
          setReconLoading(false);
        }
      };
      loadReconRecords();
    }
  }, [activeSchemaTab]);

  // Data & Master Hook
  const {
    tables,
    selectedTable,
    setSelectedTable,
    data,
    loading,
    searchTerm,
    setSearchTerm,
    editingRow,
    setEditingRow,
    isNewRow,
    newFieldName,
    setNewFieldName,
    newFieldType,
    setNewFieldType,
    newTableName,
    setNewTableName,
    isExporting,
    currentColumns,
    editorColumns,
    purchaseOrders,
    fetchTables,
    fetchData,
    handleSave,
    handleDelete,
    handleDeleteColumn,
    handleAddField,
    handleCreateTable,
    handleDropTable,
    handleCsvImport,
    handleDatabaseExport
  } = useAdminDeskData({ isAuthenticated });

  // Logs & Print Queue Hook
  const {
    logFilter,
    setLogFilter,
    logType,
    setLogType,
    logSubTab,
    setLogSubTab,
    printLogs,
    printQueue,
    printingItem,
    setPrintingItem,
    queueModule,
    setQueueModule,
    queueDocRef,
    setQueueDocRef,
    queueLoading,
    queueError,
    expandedSyncRow,
    setExpandedSyncRow,
    savePrintQueueObj,
    handleAddToQueue,
    handleClearPrintLogs
  } = useAdminDeskLogs();

  // Authentication Guard
  if (!isAuthenticated) {
    return (
      <AdminDeskLoginModal
        onSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return (
    <div className="w-full h-full font-sans text-slate-800 flex flex-col overflow-hidden">
      {/* 1. Row Editor Modal Overlay */}
      {editingRow && (
        <AdminDeskRowEditorModal
          editingRow={editingRow}
          setEditingRow={setEditingRow}
          isNewRow={isNewRow}
          selectedTable={selectedTable}
          editorColumns={editorColumns}
          currentColumns={currentColumns}
          data={data}
          loading={loading}
          onSave={handleSave}
          onClose={() => setEditingRow(null)}
        />
      )}

      {/* 2. Print Queue Item Preview Modal */}
      {printingItem && (
        <AdminDeskPrintPreviewModal
          printingItem={printingItem}
          onClose={() => setPrintingItem(null)}
        />
      )}

      {/* 3. Theme Layout View Mode */}
      {useMaterialTheme ? (
        <AdminDeskMaterialLayout
          useMaterialTheme={useMaterialTheme}
          setUseMaterialTheme={setUseMaterialTheme}
          activeMaterialPage={activeMaterialPage}
          setActiveMaterialPage={setActiveMaterialPage}
          tables={tables}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          data={data}
          loading={loading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          currentColumns={currentColumns}
          editorColumns={editorColumns}
          purchaseOrders={purchaseOrders}
          setEditingRow={setEditingRow}
          handleDelete={handleDelete}
          handleDeleteColumn={handleDeleteColumn}
          handleAddField={handleAddField}
          handleCreateTable={handleCreateTable}
          handleDropTable={handleDropTable}
          handleCsvImport={handleCsvImport}
          handleDatabaseExport={handleDatabaseExport}
          newFieldName={newFieldName}
          setNewFieldName={setNewFieldName}
          newFieldType={newFieldType}
          setNewFieldType={setNewFieldType}
          newTableName={newTableName}
          setNewTableName={setNewTableName}
          isExporting={isExporting}
          fetchData={fetchData}
          systemLogs={systemLogs}
          printLogs={printLogs}
          printQueue={printQueue}
          logFilter={logFilter}
          setLogFilter={setLogFilter}
          logType={logType}
          setLogType={setLogType}
          logSubTab={logSubTab}
          setLogSubTab={setLogSubTab}
          queueModule={queueModule}
          setQueueModule={setQueueModule}
          queueDocRef={queueDocRef}
          setQueueDocRef={setQueueDocRef}
          queueLoading={queueLoading}
          queueError={queueError}
          expandedSyncRow={expandedSyncRow}
          setExpandedSyncRow={setExpandedSyncRow}
          setPrintingItem={setPrintingItem}
          savePrintQueueObj={savePrintQueueObj}
          handleAddToQueue={handleAddToQueue}
          handleClearPrintLogs={handleClearPrintLogs}
          onClearLogs={onClearLogs}
          onClose={onClose}
        />
      ) : (
        <AdminDeskClassicLayout
          useMaterialTheme={useMaterialTheme}
          setUseMaterialTheme={setUseMaterialTheme}
          activeSchemaTab={activeSchemaTab}
          setActiveSchemaTab={setActiveSchemaTab}
          tables={tables}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          data={data}
          loading={loading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          currentColumns={currentColumns}
          editorColumns={editorColumns}
          setEditingRow={setEditingRow}
          handleDelete={handleDelete}
          handleDeleteColumn={handleDeleteColumn}
          handleAddField={handleAddField}
          handleCreateTable={handleCreateTable}
          handleDropTable={handleDropTable}
          handleCsvImport={handleCsvImport}
          handleDatabaseExport={handleDatabaseExport}
          newFieldName={newFieldName}
          setNewFieldName={setNewFieldName}
          newFieldType={newFieldType}
          setNewFieldType={setNewFieldType}
          newTableName={newTableName}
          setNewTableName={setNewTableName}
          isExporting={isExporting}
          fetchData={fetchData}
          reconRecords={reconRecords}
          selectedReconId={selectedReconId}
          setSelectedReconId={setSelectedReconId}
          reconLoading={reconLoading}
          systemLogs={systemLogs}
          printLogs={printLogs}
          printQueue={printQueue}
          logFilter={logFilter}
          setLogFilter={setLogFilter}
          logType={logType}
          setLogType={setLogType}
          logSubTab={logSubTab}
          setLogSubTab={setLogSubTab}
          queueModule={queueModule}
          setQueueModule={setQueueModule}
          queueDocRef={queueDocRef}
          setQueueDocRef={setQueueDocRef}
          queueLoading={queueLoading}
          queueError={queueError}
          expandedSyncRow={expandedSyncRow}
          setExpandedSyncRow={setExpandedSyncRow}
          setPrintingItem={setPrintingItem}
          savePrintQueueObj={savePrintQueueObj}
          handleAddToQueue={handleAddToQueue}
          handleClearPrintLogs={handleClearPrintLogs}
          onClearLogs={onClearLogs}
          onClose={onClose}
        />
      )}
    </div>
  );
}
