import React, { useMemo } from 'react';
import { Settings, Plus, Trash2, Layers, CheckCircle2, XCircle, Edit3, ArrowRight } from 'lucide-react';
import SectionHeader from './SectionHeader';
import SearchableSelect from './SearchableSelect';
import SearchableMultiSelect from './SearchableMultiSelect';

export interface ApplicableCombination {
  id?: string;
  agency: string;
  marka: string;
  quality: string;
  rs: number;
  qty?: number;
  enabled?: boolean;
}

interface QualityDetailsTableProps {
  qualityDetails: any[];
  onQualityChange: (index: number, field: string, value: any) => void;
  onAddRow: () => void;
  onDeleteRow: () => void;
  onRemoveRowAt: (index: number) => void;
  grades: any[];
  agencies: any[];
  markas: any[];
  isUser010?: boolean;
}

export const QualityDetailsTable: React.FC<QualityDetailsTableProps> = ({
  qualityDetails,
  onQualityChange,
  onAddRow,
  onDeleteRow,
  onRemoveRowAt,
  grades,
  agencies,
  markas,
  isUser010 = false
}) => {
  // Format options lists
  const gradeOptions = useMemo(() => {
    const list: string[] = [];
    [...grades]
      .sort((a, b) => (a.grade_name || a.grade_code || "").localeCompare(b.grade_name || b.grade_code || ""))
      .forEach(g => {
        const val = g.grade_name || g.grade_code || g.name || '';
        if (val && !list.includes(val)) list.push(val);
      });
    return list;
  }, [grades]);

  const agencyOptions = useMemo(() => {
    const list: string[] = [];
    [...agencies]
      .sort((a, b) => (a.agency_name || a.name || "").localeCompare(b.agency_name || b.name || ""))
      .forEach(a => {
        const val = a.agency_name || a.name || (typeof a === 'string' ? a : '');
        if (val && !list.includes(val)) list.push(val);
      });
    return list;
  }, [agencies]);

  const markaOptions = useMemo(() => {
    const list: string[] = [];
    [...markas]
      .sort((a, b) => (a.marka_name || a.name || "").localeCompare(b.marka_name || b.name || ""))
      .forEach(m => {
        const val = m.marka_name || m.name || (typeof m === 'string' ? m : '');
        if (val && !list.includes(val)) list.push(val);
      });
    return list;
  }, [markas]);

  // Compute all active combinations across all rows for the master table
  const allCombinations = useMemo(() => {
    const results: Array<{
      rowIndex: number;
      combIndex: number;
      quality: string;
      agency: string;
      marka: string;
      rs: number;
      qty: number;
      enabled: boolean;
    }> = [];

    qualityDetails.forEach((row, rIdx) => {
      const q = String(row.quality || '').trim();
      const defaultRs = Number(row.rs) || 0;
      const defaultQty = Number(row.qty) || 0;

      const rowAgencies: string[] = (
        Array.isArray(row.agencies) && row.agencies.length > 0
          ? row.agencies
          : (row.agency ? [row.agency] : [])
      ).map((a: string) => String(a || '').trim()).filter(Boolean);

      const rowMarkas: string[] = (
        Array.isArray(row.markas) && row.markas.length > 0
          ? row.markas
          : (row.marka ? [row.marka] : [])
      ).map((m: string) => String(m || '').trim()).filter(Boolean);

      // Check if user has customized combinations in applicableCombinations
      const appCombs: ApplicableCombination[] = Array.isArray(row.applicableCombinations)
        ? row.applicableCombinations
        : [];

      // If user has specific applicable combinations stored
      if (appCombs.length > 0) {
        appCombs.forEach((c, cIdx) => {
          results.push({
            rowIndex: rIdx,
            combIndex: cIdx,
            quality: c.quality || q,
            agency: c.agency,
            marka: c.marka,
            rs: Number(c.rs) || defaultRs,
            qty: Number(c.qty) || defaultQty,
            enabled: c.enabled !== false
          });
        });
      } else if (rowAgencies.length > 0 && rowMarkas.length > 0) {
        // Generate cross-product of agencies x markas
        let cIdx = 0;
        rowAgencies.forEach(ag => {
          rowMarkas.forEach(mk => {
            results.push({
              rowIndex: rIdx,
              combIndex: cIdx++,
              quality: q,
              agency: ag,
              marka: mk,
              rs: defaultRs,
              qty: defaultQty,
              enabled: true
            });
          });
        });
      } else if (rowAgencies.length > 0) {
        rowAgencies.forEach((ag, cIdx) => {
          results.push({
            rowIndex: rIdx,
            combIndex: cIdx,
            quality: q,
            agency: ag,
            marka: String(row.marka || '-').trim(),
            rs: defaultRs,
            qty: defaultQty,
            enabled: true
          });
        });
      } else if (rowMarkas.length > 0) {
        rowMarkas.forEach((mk, cIdx) => {
          results.push({
            rowIndex: rIdx,
            combIndex: cIdx,
            quality: q,
            agency: String(row.agency || '-').trim(),
            marka: mk,
            rs: defaultRs,
            qty: defaultQty,
            enabled: true
          });
        });
      } else if (q || defaultRs > 0 || row.agency || row.marka) {
        results.push({
          rowIndex: rIdx,
          combIndex: 0,
          quality: q,
          agency: String(row.agency || '-').trim(),
          marka: String(row.marka || '-').trim(),
          rs: defaultRs,
          qty: defaultQty,
          enabled: true
        });
      }
    });

    return results;
  }, [qualityDetails]);

  // Handler to toggle an individual combination's applicability
  const handleToggleCombination = (rowIndex: number, agency: string, marka: string, currentEnabled: boolean) => {
    const row = qualityDetails[rowIndex];
    if (!row) return;

    // Build current list of applicable combinations
    let appCombs: ApplicableCombination[] = Array.isArray(row.applicableCombinations)
      ? [...row.applicableCombinations]
      : [];

    if (appCombs.length === 0) {
      // Initialize from current agencies x markas
      const rowAgencies: string[] = (
        Array.isArray(row.agencies) && row.agencies.length > 0
          ? row.agencies
          : (row.agency ? [row.agency] : [''])
      ).filter(Boolean);

      const rowMarkas: string[] = (
        Array.isArray(row.markas) && row.markas.length > 0
          ? row.markas
          : (row.marka ? [row.marka] : [''])
      ).filter(Boolean);

      rowAgencies.forEach(ag => {
        rowMarkas.forEach(mk => {
          appCombs.push({
            agency: ag,
            marka: mk,
            quality: row.quality || '',
            rs: Number(row.rs) || 0,
            qty: Number(row.qty) || 0,
            enabled: true
          });
        });
      });
    }

    const target = appCombs.find(
      c => c.agency.toUpperCase() === agency.toUpperCase() && c.marka.toUpperCase() === marka.toUpperCase()
    );

    if (target) {
      target.enabled = !currentEnabled;
    } else {
      appCombs.push({
        agency,
        marka,
        quality: row.quality || '',
        rs: Number(row.rs) || 0,
        qty: Number(row.qty) || 0,
        enabled: !currentEnabled
      });
    }

    onQualityChange(rowIndex, 'applicableCombinations', appCombs);
  };

  // Handler to delete a specific combination from the row
  const handleDeleteCombination = (rowIndex: number, agency: string, marka: string) => {
    handleToggleCombination(rowIndex, agency, marka, true); // disable it
  };

  // Handler to update rate for a specific combination
  const handleUpdateCombinationRate = (rowIndex: number, agency: string, marka: string, newRate: number) => {
    const row = qualityDetails[rowIndex];
    if (!row) return;

    let appCombs: ApplicableCombination[] = Array.isArray(row.applicableCombinations)
      ? [...row.applicableCombinations]
      : [];

    if (appCombs.length === 0) {
      const rowAgencies: string[] = (
        Array.isArray(row.agencies) && row.agencies.length > 0
          ? row.agencies
          : (row.agency ? [row.agency] : [''])
      ).filter(Boolean);

      const rowMarkas: string[] = (
        Array.isArray(row.markas) && row.markas.length > 0
          ? row.markas
          : (row.marka ? [row.marka] : [''])
      ).filter(Boolean);

      rowAgencies.forEach(ag => {
        rowMarkas.forEach(mk => {
          appCombs.push({
            agency: ag,
            marka: mk,
            quality: row.quality || '',
            rs: Number(row.rs) || 0,
            qty: Number(row.qty) || 0,
            enabled: true
          });
        });
      });
    }

    const target = appCombs.find(
      c => c.agency.toUpperCase() === agency.toUpperCase() && c.marka.toUpperCase() === marka.toUpperCase()
    );

    if (target) {
      target.rs = newRate;
    } else {
      appCombs.push({
        agency,
        marka,
        quality: row.quality || '',
        rs: newRate,
        qty: Number(row.qty) || 0,
        enabled: true
      });
    }

    onQualityChange(rowIndex, 'applicableCombinations', appCombs);
  };

  return (
    <div className="bg-white rounded-[18px] p-4 sm:p-5 shadow-md border border-[#D8D3C5] hover:border-[#174C2C]/40 hover:shadow-lg transition-all w-full max-w-full min-w-0">
      <SectionHeader
        icon={Settings}
        title="Quality Details (Multiple Agency & Marka Support)"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddRow}
              className="bg-[#174C2C] hover:bg-[#113A21] text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Add another Quality configuration row"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Spawn Row</span>
            </button>
            <button
              type="button"
              onClick={onDeleteRow}
              className="border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Remove last row"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Row</span>
            </button>
          </div>
        }
      />

      {/* Main Rows Setup Table */}
      <div className="rounded-xl border border-[#E0DBCF] shadow-2xs bg-white mb-5 w-full overflow-visible relative z-10">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 z-20 shadow-2xs">
            <tr className="bg-[#EDF4EF] text-[#174C2C] font-bold text-xs uppercase border-b border-[#D8E4DC]">
              {isUser010 ? (
                <>
                  <th className="px-3.5 py-2.5 w-3/5 bg-[#EDF4EF] rounded-tl-xl">
                    Quality
                  </th>
                  <th className="px-3.5 py-2.5 w-2/5 text-right bg-[#EDF4EF]">
                    Rs.
                  </th>
                  <th className="px-2 py-2.5 w-12 text-center bg-[#EDF4EF] rounded-tr-xl"></th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2.5 w-[31%] bg-[#EDF4EF] rounded-tl-xl">
                    Agency <span className="text-[10px] text-emerald-700 font-semibold normal-case">(Multiple Select)</span>
                  </th>
                  <th className="px-3 py-2.5 w-[31%] bg-[#EDF4EF]">
                    Marka <span className="text-[10px] text-emerald-700 font-semibold normal-case">(Multiple Select)</span>
                  </th>
                  <th className="px-3 py-2.5 w-[21%] bg-[#EDF4EF]">
                    Quality <span className="text-rose-600 font-black">*</span>
                  </th>
                  <th className="px-3 py-2.5 w-[13%] text-right bg-[#EDF4EF]">
                    Rs. <span className="text-rose-600 font-black">*</span>
                  </th>
                  <th className="px-1 py-2.5 w-[4%] text-center bg-[#EDF4EF] rounded-tr-xl"></th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE6DD] text-xs">
            {qualityDetails.map((qd, i) => {
              const currentAgencies = Array.isArray(qd.agencies) && qd.agencies.length > 0
                ? qd.agencies
                : (qd.agency ? [qd.agency] : []);

              const currentMarkas = Array.isArray(qd.markas) && qd.markas.length > 0
                ? qd.markas
                : (qd.marka ? [qd.marka] : []);

              // Get row's applicable combinations
              const rowCombs = allCombinations.filter(c => c.rowIndex === i);

              // Disallow duplicate Quality selection: filter out qualities selected in other rows
              const otherRowQualities = new Set(
                qualityDetails
                  .filter((_, idx) => idx !== i)
                  .map(r => String(r.quality || '').trim().toUpperCase())
                  .filter(Boolean)
              );
              const availableGradeOptions = gradeOptions.filter(g => {
                const norm = String(g).trim().toUpperCase();
                return norm === String(qd.quality || '').trim().toUpperCase() || !otherRowQualities.has(norm);
              });

              return (
                <React.Fragment key={i}>
                  <tr 
                    style={{ zIndex: Math.max(10, 80 - i * 5) }}
                    className="hover:bg-[#F9F8F5] transition-colors relative focus-within:z-[90]"
                  >
                      {isUser010 ? (
                        <>
                          {/* Quality - SEARCHABLE SELECT */}
                          <td className="p-2.5 align-top">
                            <SearchableSelect
                              id={`qd_quality_${i}`}
                              name="qd_quality"
                              value={qd.quality || ''}
                              onChange={(val) => onQualityChange(i, 'quality', val)}
                              options={availableGradeOptions}
                              placeholder="Select Quality..."
                              isRequired={false}
                              compact={true}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Agency - SEARCHABLE MULTI-SELECT */}
                          <td className="p-2.5 align-top">
                            <SearchableMultiSelect
                              id={`agency_${i}`}
                              name="agency"
                              selectedValues={currentAgencies}
                              onChange={(vals) => {
                                onQualityChange(i, 'agencies', vals);
                                onQualityChange(i, 'agency', vals[0] || '');
                                // Reset custom combinations so they regenerate for the new agency selection
                                onQualityChange(i, 'applicableCombinations', undefined);
                              }}
                              options={agencyOptions}
                              placeholder="Select / search Agencies..."
                              badgeTheme="emerald"
                            />
                          </td>

                          {/* Marka - SEARCHABLE MULTI-SELECT */}
                          <td className="p-2.5 align-top">
                            <SearchableMultiSelect
                              id={`marka_${i}`}
                              name="marka"
                              selectedValues={currentMarkas}
                              onChange={(vals) => {
                                onQualityChange(i, 'markas', vals);
                                onQualityChange(i, 'marka', vals[0] || '');
                                // Reset custom combinations so they regenerate for the new marka selection
                                onQualityChange(i, 'applicableCombinations', undefined);
                              }}
                              options={markaOptions}
                              placeholder="Select / search Markas..."
                              badgeTheme="amber"
                            />
                          </td>

                          {/* Quality - SEARCHABLE SELECT */}
                          <td className="p-2.5 align-top">
                            <SearchableSelect
                              id={`qd_quality_${i}`}
                              name="qd_quality"
                              value={qd.quality || ''}
                              onChange={(val) => onQualityChange(i, 'quality', val)}
                              options={availableGradeOptions}
                              placeholder="--Select Quality *--"
                              isRequired={true}
                              compact={true}
                            />
                          </td>
                        </>
                      )}

                      {/* Rs. / Rate */}
                      <td className="p-2.5 align-top">
                        <input
                          id={`rs_${i}`}
                          name="rs"
                          aria-label="Rs."
                          type="number"
                          step="0.01"
                          required={!isUser010}
                          value={qd.rs ? qd.rs : ''}
                          onChange={(e) => onQualityChange(i, 'rs', e.target.value)}
                          placeholder={isUser010 ? "Rs." : "Rs. *"}
                          className={`w-full rounded-lg px-2.5 py-2 text-xs font-bold text-right outline-none transition-all font-mono ${
                            isUser010
                              ? "bg-white border border-[#D5D0C5] text-slate-800 focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C]/20"
                              : "bg-[#FFECEC] border-2 border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-slate-900 font-black"
                          }`}
                        />
                      </td>

                      {/* Action Delete Row */}
                      <td className="p-2.5 align-top text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveRowAt(i)}
                          title="Delete row"
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>

                    {/* Sub-row: Preview and individual combination chips for this row */}
                    {!isUser010 && rowCombs.length > 1 && (
                      <tr className="bg-slate-50/70 border-b border-slate-200/80">
                        <td colSpan={5} className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1 shrink-0">
                              <Layers className="w-3.5 h-3.5 text-emerald-700" />
                              Applicable Combinations for {qd.quality || 'Row'}:
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                              {rowCombs.map((comb, cIdx) => (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => handleToggleCombination(i, comb.agency, comb.marka, comb.enabled)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer shadow-2xs ${
                                    comb.enabled
                                      ? 'bg-emerald-100/90 text-emerald-950 border-emerald-300 hover:bg-emerald-200'
                                      : 'bg-slate-100 text-slate-400 border-slate-200 line-through hover:bg-slate-200'
                                  }`}
                                  title={comb.enabled ? 'Click to exclude this combination' : 'Click to re-include this combination'}
                                >
                                  {comb.enabled ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-slate-400 shrink-0" />
                                  )}
                                  <span>{comb.agency} + {comb.marka}</span>
                                  <span className="font-mono text-emerald-800 font-black">
                                    ₹{Number(comb.rs).toLocaleString()}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
      </div>
    </div>
  );
};

export default QualityDetailsTable;
