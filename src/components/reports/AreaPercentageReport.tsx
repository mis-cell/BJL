import React, { useState, useMemo } from 'react';
import { CompiledReportData } from '../../services/reportCalculations';
import { 
  MapPin, 
  Download, 
  Search, 
  Navigation, 
  TrendingUp, 
  Truck, 
  ShieldCheck,
  ChevronRight,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportHelpers';

interface AreaPercentageReportProps {
  areaSummary: CompiledReportData['areaSummary'];
}

export const AreaPercentageReport: React.FC<AreaPercentageReportProps> = ({ areaSummary }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('contractedWeightMT');
  const [sortAsc, setSortAsc] = useState(false);

  const states = useMemo(() => {
    return Array.from(new Set(areaSummary.map(a => a.state))).filter(Boolean);
  }, [areaSummary]);

  const filteredAreas = useMemo(() => {
    let list = areaSummary.filter(a => {
      const matchSearch = a.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.state.toLowerCase().includes(searchTerm.toLowerCase());
      const matchState = selectedState === 'ALL' || a.state === selectedState;
      return matchSearch && matchState;
    });

    list.sort((a: any, b: any) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [areaSummary, searchTerm, selectedState, sortField, sortAsc]);

  const handleExport = () => {
    const headers = [
      'State',
      'District',
      'Area / Hub',
      'Suppliers',
      'Brokers',
      'Contracts',
      'Contract Wt (MT)',
      'Delivered Wt (MT)',
      'Pending Wt (MT)',
      'Delivered %',
      'Pending %',
      'Avg Rate',
      'Procurement Value',
      'Avg Transit Days',
      'On-Time %',
      'Delayed %',
      'Lorry Count',
      'Avg Wt / Lorry',
      'Performance Status'
    ];

    const rows = filteredAreas.map(a => [
      a.state,
      a.district,
      a.area,
      a.totalSuppliers,
      a.totalBrokers,
      a.totalContracts,
      a.contractedWeightMT,
      a.deliveredWeightMT,
      a.pendingWeightMT,
      `${a.deliveredPct}%`,
      `${a.pendingPct}%`,
      a.avgRate,
      a.procurementValue,
      a.avgTransitDays,
      `${a.onTimePct}%`,
      `${a.delayedPct}%`,
      a.lorryCount,
      a.avgWeightPerLorry,
      a.performanceStatus
    ]);

    exportToCSV(`Area_Percentage_Analysis_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              Area-Wise Delivery, Pending & Sourcing Logistics Analysis
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Geographic sourcing breakdown across State, District, and Procurement Hubs with transit compliance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* State Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-bold">
            <button
              onClick={() => setSelectedState('ALL')}
              className={`px-2 py-1 rounded transition-colors ${
                selectedState === 'ALL' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All States
            </button>
            {states.map(st => (
              <button
                key={st}
                onClick={() => setSelectedState(st)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedState === st ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md text-slate-800 outline-none focus:border-emerald-500 w-40"
            />
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead className="bg-slate-800 text-white sticky top-0 text-[9px] uppercase tracking-wider font-mono z-10">
              <tr>
                <th onClick={() => handleSort('state')} className="p-2.5 px-3 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">State <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('district')} className="p-2.5 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">District <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('area')} className="p-2.5 border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-between">Area / Hub <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 text-center border-r border-slate-700">Suppliers</th>
                <th className="p-2.5 text-center border-r border-slate-700">Contracts</th>
                <th onClick={() => handleSort('contractedWeightMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Contract Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('deliveredWeightMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Delivered Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('pendingWeightMT')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Pending Wt <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('deliveredPct')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Delivered % <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('pendingPct')} className="p-2.5 text-right border-r border-slate-700 cursor-pointer hover:bg-slate-700">
                  <div className="flex items-center justify-end gap-1">Pending % <ArrowUpDown className="w-3 h-3 opacity-60" /></div>
                </th>
                <th className="p-2.5 text-right border-r border-slate-700">Transit Days</th>
                <th className="p-2.5 text-right border-r border-slate-700">On-Time %</th>
                <th className="p-2.5 text-right border-r border-slate-700">Lorries</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredAreas.map((a) => (
                <tr 
                  key={a.area}
                  className="hover:bg-emerald-50/40 transition-colors even:bg-slate-50/50"
                >
                  <td className="p-2.5 px-3 font-sans font-bold text-slate-800 border-r border-slate-100">
                    {a.state}
                  </td>
                  <td className="p-2.5 text-slate-700 border-r border-slate-100 font-semibold">{a.district}</td>
                  <td className="p-2.5 text-slate-900 border-r border-slate-100 font-bold">{a.area}</td>
                  <td className="p-2.5 text-center text-slate-600 border-r border-slate-100">{a.totalSuppliers}</td>
                  <td className="p-2.5 text-center text-slate-700 border-r border-slate-100">{a.totalContracts}</td>
                  <td className="p-2.5 text-right text-slate-900 border-r border-slate-100 font-bold">{a.contractedWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-emerald-800 border-r border-slate-100 font-bold">{a.deliveredWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right text-amber-800 border-r border-slate-100 font-bold">{a.pendingWeightMT.toLocaleString()}</td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                      {a.deliveredPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-right border-r border-slate-100">
                    <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                      {a.pendingPct}%
                    </span>
                  </td>
                  <td className="p-2.5 text-right text-slate-700 border-r border-slate-100 font-bold">{a.avgTransitDays}d</td>
                  <td className="p-2.5 text-right text-slate-800 border-r border-slate-100 font-bold">{a.onTimePct}%</td>
                  <td className="p-2.5 text-right text-slate-700 border-r border-slate-100">{a.lorryCount}</td>
                  <td className="p-2.5 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-sans font-bold">
                      {a.performanceStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAreas.length === 0 && (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-slate-400 italic">
                    No matching sourcing area records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
