import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { dbModule } from '../../services/dbModule';
import { PrintLogEntry, PrintQueueItem, SyncLogEntry } from './adminDeskTypes';

export function useAdminDeskLogs() {
  const [logFilter, setLogFilter] = useState('');
  const [logType, setLogType] = useState('ALL');
  const [logSubTab, setLogSubTab] = useState<'system' | 'print' | 'queue' | 'sync'>('system');
  const [printLogs, setPrintLogs] = useState<PrintLogEntry[]>([]);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [printingItem, setPrintingItem] = useState<any | null>(null);

  const [queueModule, setQueueModule] = useState<'po' | 'sauda' | 'amad' | 'material_inspection' | 'stock'>('po');
  const [queueDocRef, setQueueDocRef] = useState('');
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [expandedSyncRow, setExpandedSyncRow] = useState<string | null>(null);

  // Load Print Queue from localStorage on mount
  useEffect(() => {
    try {
      const savedQueue = localStorage.getItem('mill_central_print_queue');
      if (savedQueue) {
        setPrintQueue(JSON.parse(savedQueue === 'undefined' ? 'null' : savedQueue) || []);
      }
    } catch (e) {
      console.error('Failed to parse mill_central_print_queue from localStorage:', e);
    }
  }, []);

  const savePrintQueueObj = (updatedQueue: PrintQueueItem[]) => {
    setPrintQueue(updatedQueue);
    try {
      localStorage.setItem('mill_central_print_queue', JSON.stringify(updatedQueue));
    } catch (e) {
      console.error('Failed to write mill_central_print_queue:', e);
    }
  };

  const handleAddToQueue = async () => {
    if (!queueDocRef.trim()) {
      setQueueError('Please key in a reference identifier first.');
      return;
    }
    setQueueLoading(true);
    setQueueError('');
    try {
      let docTitle = ``;
      let docSummary = ``;
      let payload: any = {};
      const id = Date.now().toString();
      const timestamp = new Date().toISOString();

      if (!supabase) {
        docTitle = `${queueModule.toUpperCase()} - Manual Receipt #${queueDocRef}`;
        docSummary = `Offline local registry bypass. Custom reference: ${queueDocRef}`;
        payload = { ref: queueDocRef, module: queueModule, offline: true, date: new Date().toLocaleDateString() };
      } else {
        if (queueModule === 'po') {
          const { data, error } = await supabase
            .from('purchase_master')
            .select('*')
            .ilike('po_no', `%${queueDocRef.trim()}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No purchase orders (P.O) found matching PO reference "${queueDocRef}"`);
          }
          const po = data[0];
          docTitle = `Purchase Order Contract`;
          docSummary = `Ref: ${po.po_no} | Supplier: ${po.supplier_name || po.supplier || 'N/A'} | Weight Contract: ${po.total_contract_mt || 0} MT`;
          payload = po;
        } else if (queueModule === 'sauda') {
          const { data, error } = await supabase
            .from('sauda_master')
            .select('*')
            .or(`sauda_id.eq.${Number(queueDocRef) || -1},broker.ilike.%${queueDocRef}%,party_name.ilike.%${queueDocRef}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No Saudas found matching Sauda identifier/party "${queueDocRef}"`);
          }
          const s = data[0];
          docTitle = `Sauda Contract Agreement`;
          docSummary = `Ref ID: ${s.sauda_id} | Party: ${s.party_name || 'N/A'} | Rate: Rs. ${s.b_rate || 0} | Weight: ${s.total_wt_in_ton || 0} MT`;
          payload = s;
        } else if (queueModule === 'amad') {
          const { data, error } = await supabase
            .from('temporary_material_received')
            .select('*')
            .or(`temporary_arrival_no.ilike.%${queueDocRef}%,lorry_number.ilike.%${queueDocRef}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No arrivals (AMAD) found matching reference/lorry "${queueDocRef}"`);
          }
          const a = data[0];
          docTitle = `Station Temporary M.R Gatepass`;
          docSummary = `Amad No: ${a.amad_no || 'N/A'} | Lorry Number: ${a.lorry_number} | Packets: ${a.packets || 0} | Weight: ${a.weight || 0} Qtl`;
          payload = a;
        } else if (queueModule === 'material_inspection') {
          const { data, error } = await supabase
            .from('mill_inspection_master')
            .select('*')
            .ilike('mr_no', `%${queueDocRef.trim()}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No inspections found matching inspection M.R. No "${queueDocRef}"`);
          }
          const insp = data[0];
          docTitle = `Material Quality Inspection Certificate`;
          docSummary = `M.R. No: ${insp.mr_no} | Moisture: ${insp.actual_moisture || 0}% | Supplier: ${insp.supplier_name || 'N/A'}`;
          payload = insp;
        } else if (queueModule === 'stock') {
          const { data, error } = await supabase
            .from('opening_stock')
            .select('*')
            .or(`grade.ilike.%${queueDocRef}%,godown.ilike.%${queueDocRef}%`)
            .order('id')
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No stock registers found matching "${queueDocRef}"`);
          }
          const st = data[0];
          docTitle = `Opening Stock Ledger`;
          docSummary = `Grade: ${st.grade} | Godown: ${st.godown} | Quantity: ${st.quantity} BALES | Weight: ${st.weight} Kg`;
          payload = st;
        }
      }

      const newItem: PrintQueueItem = {
        id,
        module: queueModule,
        refNo: queueDocRef.toUpperCase(),
        title: docTitle,
        summary: docSummary,
        timestamp,
        payload
      };

      const updated = [newItem, ...printQueue];
      savePrintQueueObj(updated);
      setQueueDocRef('');
    } catch (err: any) {
      setQueueError(err.message || String(err));
    } finally {
      setQueueLoading(false);
    }
  };

  const loadPrintLogs = async () => {
    try {
      const logs = await dbModule.fetchAll('mill_print_logs', 'timestamp', false).catch(() => []);
      if (logs && logs.length > 0) {
        setPrintLogs(logs);
      } else {
        const local = localStorage.getItem('mill_print_logs');
        if (local) {
          setPrintLogs(JSON.parse(local));
        }
      }
    } catch (e) {
      console.warn('Failed to fetch print logs:', e);
    }
  };

  const handleClearPrintLogs = () => {
    if (confirm('Clear inspection print logs permanently from local storage?')) {
      localStorage.removeItem('mill_print_logs');
      setPrintLogs([]);
    }
  };

  useEffect(() => {
    loadPrintLogs();
  }, [logSubTab]);

  return {
    logFilter,
    setLogFilter,
    logType,
    setLogType,
    logSubTab,
    setLogSubTab,
    printLogs,
    setPrintLogs,
    printQueue,
    setPrintQueue,
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
    loadPrintLogs,
    handleClearPrintLogs
  };
}
