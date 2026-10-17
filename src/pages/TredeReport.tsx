import React, { useState, useMemo } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import {
  Plus,
  Search,
  Trash2,
  Save,
  X,
  Printer,
  FileText,
  RefreshCcw,
  Download,
  BookOpen,
  Users,
  Edit2,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard
} from 'lucide-react';
import LegacyLayout from '../components/LegacyLayout';
import { dbModule } from '../services/dbModule';
import { formatIndianCurrency } from '../lib/utils';
import { exportToCSV } from '../utils/exportHelpers';
import { enforceEditOrDeletePermission } from '../lib/permissions';
import { PaginationControls } from '../components/PaginationControls';

export interface TraderRecord {
  id?: string;
  supp_code: string;
  supp_name: string;
  proprietor_name: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  phone: string;
  email: string;
  gst_no: string;
  pan_no: string;
  bank_name: string;
  account_no: string;
  ifsc_code: string;
  opening_balance: number;
  status: string;
}

const emptyTrader = (): TraderRecord => ({
  supp_code: `SUP-${Date.now().toString().slice(-4)}`,
  supp_name: '',
  proprietor_name: '',
  address: '',
  city: 'KOLKATA',
  state: 'WEST BENGAL',
  pin_code: '',
  phone: '',
  email: '',
  gst_no: '',
  pan_no: '',
  bank_name: '',
  account_no: '',
  ifsc_code: '',
  opening_balance: 0,
  status: 'Active'
});

export default function TredeReport({ onClose }: { onClose?: () => void }) {
  const [traders, setTraders] = useState<TraderRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrader, setEditingTrader] = useState<TraderRecord | null>(null);
  const [formData, setFormData] = useState<TraderRecord>(emptyTrader());
  const [selectedLedgerTrader, setSelectedLedgerTrader] = useState<TraderRecord | null>(null);

  const loadDirectoryData = async () => {
    setLoading(true);
    try {
      const [suppData, custData, poData, scpData, arrData, payData] = await Promise.all([
        dbModule.fetchAll('supply_master').catch(() => []),
        dbModule.fetchAll('customer_master').catch(() => []),
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => []),
        dbModule.fetchAll('final_arrival').catch(() => []),
        dbModule.fetchAll('payment_master').catch(() => [])
      ]);

      const mergedMap = new Map<string, TraderRecord>();

      (suppData || []).forEach((s: any) => {
        const code = String(s.supp_code || s.supplier_code || s.code || s.id || '').trim();
        const name = String(s.supp_name || s.supplier_name || s.firm_name || s.name || '').trim();
        if (!name && !code) return;
        const key = (code || name).toUpperCase();
        mergedMap.set(key, {
          id: s.id || s.supp_id,
          supp_code: code || `SUP-${mergedMap.size + 1}`,
          supp_name: name,
          proprietor_name: String(s.proprietor_name || s.contact_person || ''),
          address: String(s.address || s.addr1 || ''),
          city: String(s.city || s.district || ''),
          state: String(s.state || 'WEST BENGAL'),
          pin_code: String(s.pin_code || s.pincode || ''),
          phone: String(s.phone || s.mobile || s.contact_no || ''),
          email: String(s.email || ''),
          gst_no: String(s.gst_no || s.gstin || ''),
          pan_no: String(s.pan_no || s.pan || ''),
          bank_name: String(s.bank_name || ''),
          account_no: String(s.account_no || s.bank_account_no || ''),
          ifsc_code: String(s.ifsc_code || ''),
          opening_balance: Number(s.opening_balance || 0),
          status: String(s.status || 'Active')
        });
      });

      (custData || []).forEach((c: any) => {
        const name = String(c.firm_name || c.supp_name || c.name || '').trim();
        const code = String(c.cust_code || c.supp_code || c.code || '').trim();
        if (!name) return;
        const key = (code || name).toUpperCase();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            id: c.id,
            supp_code: code || `TRD-${mergedMap.size + 1}`,
            supp_name: name,
            proprietor_name: String(c.proprietor_name || ''),
            address: String(c.address || ''),
            city: String(c.city || ''),
            state: String(c.state || 'WEST BENGAL'),
            pin_code: String(c.pin_code || ''),
            phone: String(c.phone || c.mobile || ''),
            email: String(c.email || ''),
            gst_no: String(c.gst_no || c.gstin || ''),
            pan_no: String(c.pan_no || ''),
            bank_name: String(c.bank_name || ''),
            account_no: String(c.account_no || ''),
            ifsc_code: String(c.ifsc_code || ''),
            opening_balance: Number(c.opening_balance || 0),
            status: String(c.status || 'Active')
          });
        }
      });

      setTraders(Array.from(mergedMap.values()).sort((a, b) => a.supp_name.localeCompare(b.supp_name)));
      setPurchaseOrders([...(poData || []), ...(scpData || [])]);
      setArrivals(arrData || []);
      setPayments(payData || []);
    } catch (err) {
      console.error('Failed to load Trader Directory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(loadDirectoryData, [], {
    tables: ['supply_master', 'customer_master', 'purchase_master', 'final_arrival', 'payment_master']
  });

  // Compute financial & operational metrics per trader
  const traderStatsMap = useMemo(() => {
    const map: Record<string, {
      poCount: number;
      contractedMT: number;
      receivedMT: number;
      billedValue: number;
      paidAmount: number;
      balancePayable: number;
      pos: any[];
      arrivals: any[];
      payments: any[];
    }> = {};

    const ensure = (name: string) => {
      const k = String(name || '').trim().toUpperCase();
      if (!map[k]) {
        map[k] = {
          poCount: 0,
          contractedMT: 0,
          receivedMT: 0,
          billedValue: 0,
          paidAmount: 0,
          balancePayable: 0,
          pos: [],
          arrivals: [],
          payments: []
        };
      }
      return map[k];
    };

    purchaseOrders.forEach(po => {
      const sup = String(po.supplier || po.challan_supplier || '').trim();
      if (!sup) return;
      const st = ensure(sup);
      st.poCount += 1;
      const mt = Number(po.total_contract_mt || po.total_wt_in_ton || 0);
      st.contractedMT += mt;
      st.pos.push(po);
    });

    arrivals.forEach(arr => {
      const sup = String(arr.supplier || arr.supplier_name || arr.challan_supplier || '').trim();
      if (!sup) return;
      const st = ensure(sup);
      const wt = Number(arr.electronic_net_weight || arr.weight_reduced || (arr.weight_qtl ? arr.weight_qtl / 10 : 0));
      const rate = Number(arr.rate || arr.b_rate || 6500);
      st.receivedMT += wt;
      st.billedValue += wt * 10 * rate;
      st.arrivals.push(arr);
    });

    payments.forEach(pay => {
      const sup = String(pay.supplier || pay.party_name || pay.chn_supplier || '').trim();
      if (!sup) return;
      const st = ensure(sup);
      const paid = Number(pay.paid_amount || pay.payable_amt || pay.total_amount || 0);
      st.paidAmount += paid;
      st.payments.push(pay);
    });

    Object.keys(map).forEach(k => {
      map[k].balancePayable = Math.max(0, map[k].billedValue - map[k].paidAmount);
    });

    return map;
  }, [purchaseOrders, arrivals, payments]);

  const availableStates = useMemo(() => {
    const s = new Set<string>();
    traders.forEach(t => {
      if (t.state) s.add(t.state.toUpperCase());
    });
    return Array.from(s).sort();
  }, [traders]);

  const filteredTraders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return traders.filter(t => {
      if (stateFilter !== 'ALL' && t.state.toUpperCase() !== stateFilter) return false;
      if (!q) return true;
      return (
        t.supp_name.toLowerCase().includes(q) ||
        t.supp_code.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.gst_no.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.proprietor_name.toLowerCase().includes(q)
      );
    });
  }, [traders, searchTerm, stateFilter]);

  const paginatedTraders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTraders.slice(start, start + pageSize);
  }, [filteredTraders, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setEditingTrader(null);
    setFormData(emptyTrader());
    setIsModalOpen(true);
  };

  const handleOpenEdit = (trader: TraderRecord) => {
    if (!enforceEditOrDeletePermission('edit this trader record')) return;
    setEditingTrader(trader);
    setFormData({ ...trader });
    setIsModalOpen(true);
  };

  const handleSaveTrader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supp_name.trim()) {
      alert('Trader / Supplier Name is required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        supp_code: formData.supp_code.trim(),
        supp_name: formData.supp_name.trim().toUpperCase(),
        proprietor_name: formData.proprietor_name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim().toUpperCase(),
        state: formData.state.trim().toUpperCase(),
        pin_code: formData.pin_code.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        gst_no: formData.gst_no.trim().toUpperCase(),
        pan_no: formData.pan_no.trim().toUpperCase(),
        bank_name: formData.bank_name.trim(),
        account_no: formData.account_no.trim(),
        ifsc_code: formData.ifsc_code.trim().toUpperCase(),
        opening_balance: Number(formData.opening_balance || 0),
        status: formData.status || 'Active'
      };

      if (editingTrader) {
        const idCol = editingTrader.id ? 'id' : 'supp_code';
        const idVal = editingTrader.id || editingTrader.supp_code;
        await dbModule.update('supply_master', idCol, idVal, payload);
      } else {
        await dbModule.insert('supply_master', payload);
      }

      setIsModalOpen(false);
      await loadDirectoryData();
    } catch (err: any) {
      console.error('Failed to save trader:', err);
      alert(`Failed to save trader in supply_master: ${err?.message || 'Database write error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrader = async (trader: TraderRecord) => {
    if (!enforceEditOrDeletePermission('delete this trader record')) return;
    if (!window.confirm(`Delete trader "${trader.supp_name}" (${trader.supp_code}) from directory?`)) return;

    setLoading(true);
    try {
      const idCol = trader.id ? 'id' : 'supp_code';
      const idVal = trader.id || trader.supp_code;
      await dbModule.delete('supply_master', idCol, idVal);
      await loadDirectoryData();
    } catch (err: any) {
      console.error('Failed to delete trader:', err);
      alert(`Failed to delete trader: ${err?.message || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredTraders.length === 0) return;
    const headers = [
      'Supplier Code',
      'Trader / Supplier Name',
      'Proprietor',
      'City',
      'State',
      'Phone',
      'Email',
      'GSTIN',
      'PAN',
      'PO Count',
      'Contracted (MT)',
      'Received (MT)',
      'Paid Amount (INR)',
      'Balance Payable (INR)',
      'Status'
    ];
    const rows = filteredTraders.map(t => {
      const st = traderStatsMap[t.supp_name.toUpperCase()] || {
        poCount: 0,
        contractedMT: 0,
        receivedMT: 0,
        paidAmount: 0,
        balancePayable: 0
      };
      return [
        t.supp_code,
        t.supp_name,
        t.proprietor_name,
        t.city,
        t.state,
        t.phone,
        t.email,
        t.gst_no,
        t.pan_no,
        st.poCount,
        st.contractedMT.toFixed(3),
        st.receivedMT.toFixed(3),
        st.paidAmount.toFixed(2),
        st.balancePayable.toFixed(2),
        t.status
      ];
    });
    exportToCSV(`trader_supplier_directory_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handlePrintDirectory = () => {
    window.print();
  };

  return (
    <LegacyLayout title="Trader & Supplier Directory (Supply Master)" onClose={onClose}>
      <div className="space-y-4 font-sans text-slate-800">
        {/* Top Action & KPI Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide text-slate-900">
                Registered Jute Traders & Suppliers Directory
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Live Master Directory (`supply_master`) with Contract, Arrival & Payment Ledger
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Trader
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handlePrintDirectory}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print Directory
            </button>
            <button
              type="button"
              onClick={loadDirectoryData}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search & State Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Trader Name, Code, GSTIN, City, Phone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 uppercase">State:</span>
            <select
              value={stateFilter}
              onChange={e => {
                setStateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold bg-white"
            >
              <option value="ALL">All States ({traders.length})</option>
              {availableStates.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Trader Directory Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Trader / Supplier Name</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">GSTIN / PAN</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-right">POs</th>
                  <th className="py-2.5 px-3 text-right">Contracted (MT)</th>
                  <th className="py-2.5 px-3 text-right">Received (MT)</th>
                  <th className="py-2.5 px-3 text-right">Paid (₹)</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {paginatedTraders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 font-bold uppercase">
                      {loading ? 'Loading Trader Directory...' : 'No Traders Found Matching Criteria'}
                    </td>
                  </tr>
                ) : (
                  paginatedTraders.map(trader => {
                    const stats = traderStatsMap[trader.supp_name.toUpperCase()] || {
                      poCount: 0,
                      contractedMT: 0,
                      receivedMT: 0,
                      paidAmount: 0,
                      balancePayable: 0
                    };
                    return (
                      <tr key={trader.supp_code + trader.supp_name} className="hover:bg-indigo-50/40 transition">
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700">{trader.supp_code}</td>
                        <td className="py-2 px-3">
                          <div className="font-black text-slate-900">{trader.supp_name}</div>
                          {trader.proprietor_name && (
                            <div className="text-[10px] text-slate-500 font-semibold">Prop: {trader.proprietor_name}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-semibold">
                          {[trader.city, trader.state].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          <div>{trader.gst_no || '—'}</div>
                          {trader.pan_no && <div className="text-[10px] text-slate-500">PAN: {trader.pan_no}</div>}
                        </td>
                        <td className="py-2 px-3 text-[11px]">
                          <div>{trader.phone || '—'}</div>
                          {trader.email && <div className="text-[10px] text-slate-500">{trader.email}</div>}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">{stats.poCount}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {stats.contractedMT.toFixed(3)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {stats.receivedMT.toFixed(3)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                          {formatIndianCurrency(stats.paidAmount)}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLedgerTrader(trader)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                              title="View Trader Ledger"
                            >
                              <BookOpen className="h-3 w-3" />
                              Ledger
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(trader)}
                              className="p-1 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded cursor-pointer"
                              title="Edit Trader"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrader(trader)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Delete Trader"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <PaginationControls
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredTraders.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>

        {/* Add / Edit Trader Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden">
              <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-400" />
                  {editingTrader ? `Edit Trader: ${editingTrader.supp_name}` : 'Add New Trader / Supplier'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTrader} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Supplier Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.supp_code}
                      onChange={e => setFormData({ ...formData, supp_code: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 uppercase mb-1">Trader / Firm Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.supp_name}
                      onChange={e => setFormData({ ...formData, supp_name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-bold uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Proprietor / Contact</label>
                    <input
                      type="text"
                      value={formData.proprietor_name}
                      onChange={e => setFormData({ ...formData, proprietor_name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Phone / Mobile</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">City / Station</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={formData.gst_no}
                      onChange={e => setFormData({ ...formData, gst_no: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">PAN No</label>
                    <input
                      type="text"
                      value={formData.pan_no}
                      onChange={e => setFormData({ ...formData, pan_no: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Account No</label>
                    <input
                      type="text"
                      value={formData.account_no}
                      onChange={e => setFormData({ ...formData, account_no: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {editingTrader ? 'Update Trader' : 'Save Trader'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Trader Ledger Modal */}
        {selectedLedgerTrader && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Trader Account Ledger: {selectedLedgerTrader.supp_name} ({selectedLedgerTrader.supp_code})
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    GSTIN: {selectedLedgerTrader.gst_no || 'N/A'} • City: {selectedLedgerTrader.city || 'N/A'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLedgerTrader(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {(() => {
                const lStats = traderStatsMap[selectedLedgerTrader.supp_name.toUpperCase()] || {
                  poCount: 0,
                  contractedMT: 0,
                  receivedMT: 0,
                  billedValue: 0,
                  paidAmount: 0,
                  balancePayable: 0,
                  pos: [],
                  arrivals: [],
                  payments: []
                };
                return (
                  <div className="p-5 overflow-y-auto space-y-4 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Contracted MT</div>
                        <div className="text-base font-black text-slate-900 mt-0.5">
                          {lStats.contractedMT.toFixed(3)} MT
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="text-[10px] font-bold uppercase text-emerald-700">Received MT</div>
                        <div className="text-base font-black text-emerald-900 mt-0.5">
                          {lStats.receivedMT.toFixed(3)} MT
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                        <div className="text-[10px] font-bold uppercase text-indigo-700">Total Paid</div>
                        <div className="text-base font-black text-indigo-900 mt-0.5">
                          {formatIndianCurrency(lStats.paidAmount)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="text-[10px] font-bold uppercase text-amber-700">Balance Payable</div>
                        <div className="text-base font-black text-amber-900 mt-0.5">
                          {formatIndianCurrency(lStats.balancePayable)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black uppercase text-slate-700 mb-2">Purchase Orders ({lStats.pos.length})</h4>
                      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-100 text-[10px] font-black uppercase">
                            <tr>
                              <th className="p-2">PO No</th>
                              <th className="p-2">Date</th>
                              <th className="p-2">Broker</th>
                              <th className="p-2 text-right">Contract MT</th>
                              <th className="p-2 text-right">Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lStats.pos.length === 0 ? (
                              <tr><td colSpan={5} className="p-3 text-center text-slate-400">No POs recorded</td></tr>
                            ) : (
                              lStats.pos.map((p: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="p-2 font-mono font-bold">{p.po_no || p.sauda_no}</td>
                                  <td className="p-2">{p.po_date || p.date || '—'}</td>
                                  <td className="p-2">{p.broker || 'DIRECT'}</td>
                                  <td className="p-2 text-right font-mono">{Number(p.total_contract_mt || 0).toFixed(3)}</td>
                                  <td className="p-2 text-right font-mono">₹{Number(p.b_rate || 0).toLocaleString('en-IN')}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black uppercase text-slate-700 mb-2">Payment Vouchers ({lStats.payments.length})</h4>
                      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-100 text-[10px] font-black uppercase">
                            <tr>
                              <th className="p-2">Voucher No</th>
                              <th className="p-2">Date</th>
                              <th className="p-2">MR / PO No</th>
                              <th className="p-2">Mode</th>
                              <th className="p-2 text-right">Paid Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lStats.payments.length === 0 ? (
                              <tr><td colSpan={5} className="p-3 text-center text-slate-400">No payments recorded</td></tr>
                            ) : (
                              lStats.payments.map((pay: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="p-2 font-mono font-bold">{pay.voucher_no || '—'}</td>
                                  <td className="p-2">{pay.payment_date || '—'}</td>
                                  <td className="p-2">{pay.mr_no || pay.po_no || '—'}</td>
                                  <td className="p-2">{pay.payment_mode || 'BANK'}</td>
                                  <td className="p-2 text-right font-mono font-bold text-emerald-700">
                                    {formatIndianCurrency(Number(pay.paid_amount || pay.payable_amt || 0))}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </LegacyLayout>
  );
}
