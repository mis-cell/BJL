import React from 'react';
import { Sauda } from '../types';

interface Props {
  sauda: Sauda;
  onClose?: () => void;
}

export default function SaudaPrintSlip({ sauda }: Props) {
  const rawQualityRows = sauda.quality_details || [];

  // Contract-level defaults if no rows exist at all
  const contractQuality = (sauda as any).quality || '';
  const contractRate = Number(sauda.b_rate) || 0;

  // Expand all active rows so Agency, Marka, Quality, Rs are rendered cleanly
  const expandedList: any[] = [];
  rawQualityRows.forEach(row => {
    // 1. If row already has explicit applicableCombinations array
    if (Array.isArray(row.applicableCombinations) && row.applicableCombinations.length > 0) {
      row.applicableCombinations.forEach((comb: any) => {
        if (comb.enabled !== false && (comb.agency || comb.marka || comb.quality || comb.rs)) {
          expandedList.push({
            agency: String(comb.agency || row.agency || '').trim(),
            marka: String(comb.marka || row.marka || '').trim(),
            quality: String(comb.quality || row.quality || '').trim(),
            rs: comb.rs ? Number(comb.rs) : (row.rs ? Number(row.rs) : 0),
            qty: Number(comb.qty) || Number(row.qty) || 0
          });
        }
      });
    } else {
      const agList: string[] = (
        Array.isArray(row.agencies) && row.agencies.length > 0
          ? row.agencies
          : (row.agency ? String(row.agency).split(',').map((x: string) => x.trim()).filter(Boolean) : [])
      );
      const mkList: string[] = (
        Array.isArray(row.markas) && row.markas.length > 0
          ? row.markas
          : (row.marka ? String(row.marka).split(',').map((x: string) => x.trim()).filter(Boolean) : [])
      );

      const rowQ = String(row.quality || '').trim();
      const rowR = row.rs !== undefined && row.rs !== null && String(row.rs).trim() !== '' ? Number(row.rs) : 0;

      if (agList.length > 0 && mkList.length > 0) {
        if (agList.length === mkList.length && agList.length > 1) {
          // 1-to-1 matching when matching counts provided (e.g. ACHINTALA with 39, ALAMPUR with ALAMPUR)
          agList.forEach((ag, idx) => {
            expandedList.push({
              agency: ag,
              marka: mkList[idx] || mkList[0] || '',
              quality: rowQ,
              rs: rowR,
              qty: Number(row.qty) || 0
            });
          });
        } else {
          // Cross-product
          agList.forEach(ag => {
            mkList.forEach(mk => {
              expandedList.push({
                agency: ag,
                marka: mk,
                quality: rowQ,
                rs: rowR,
                qty: Number(row.qty) || 0
              });
            });
          });
        }
      } else if (agList.length > 0) {
        agList.forEach(ag => {
          expandedList.push({
            agency: ag,
            marka: String(row.marka || '').trim(),
            quality: rowQ,
            rs: rowR,
            qty: Number(row.qty) || 0
          });
        });
      } else if (mkList.length > 0) {
        mkList.forEach(mk => {
          expandedList.push({
            agency: String(row.agency || '').trim(),
            marka: mk,
            quality: rowQ,
            rs: rowR,
            qty: Number(row.qty) || 0
          });
        });
      } else if (row.quality || row.agency || row.marka || Number(row.rs) > 0) {
        expandedList.push({
          agency: String(row.agency || '').trim(),
          marka: String(row.marka || '').trim(),
          quality: rowQ,
          rs: rowR,
          qty: Number(row.qty) || 0
        });
      }
    }
  });

  const qualityRows = expandedList.length > 0 
    ? expandedList 
    : (rawQualityRows.length > 0
        ? rawQualityRows.map(r => ({
            ...r,
            agency: r.agency || '',
            marka: r.marka || '',
            quality: r.quality || '',
            rs: Number(r.rs) || 0
          }))
        : [{ agency: '', marka: '', quality: contractQuality, rs: contractRate, qty: 0 }]
      );
  
  // Pad local qualities to at least 7 rows to match the physical slip format
  const paddedQualities = [...qualityRows];
  while (paddedQualities.length < 7) {
    paddedQualities.push({ quality: '', percentage: 0, rate: 0, qty: 0, rs: 0, marka: '', agency: '' });
  }

  const sessionParts = sauda.session ? sauda.session.split('/') : ['BJCL', '2026-2027', sauda.sauda_no];
  const yearStr = sessionParts[1] || '2026-2027';

  // Format any rate values nicely
  const getBrateString = () => {
    if (sauda.b_rate) {
      return `${Number(sauda.b_rate).toLocaleString('en-IN')}/-`;
    }
    // Try to find the first quality rate as a backup
    const firstWithRate = qualityRows.find(q => q.rs && Number(q.rs) > 0);
    if (firstWithRate) {
      return `${Number(firstWithRate.rs).toLocaleString('en-IN')}/-`;
    }
    return contractRate > 0 ? `${Number(contractRate).toLocaleString('en-IN')}/-` : '';
  };

  return (
    <div className="bg-white w-full max-w-[148mm] sm:w-[148mm] min-h-[210mm] mx-auto p-3 sm:p-6 flex flex-col font-sans text-black print:w-[148mm] print:h-[210mm] print:max-h-[210mm] print:p-6 print:m-0 box-border text-[10px] sm:text-[11px] leading-relaxed relative overflow-x-auto page-break-inside-avoid shadow-lg print:shadow-none">
       {/* Invoice/Contract Header */}
       <div className="flex justify-between items-center mb-2 flex-none border-b-2 border-black pb-2">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded border-2 border-black flex items-center justify-center font-serif font-black text-xs text-black shrink-0">
                BJ
             </div>
             <div className="flex flex-col">
                <div className="font-extrabold text-[15px] text-black leading-tight tracking-tight">BALLY JUTE COMPANY LIMITED</div>
                <div className="text-[10px] font-bold text-neutral-800 tracking-wider font-mono">SAUDA CONTRACT SLIP • {yearStr}</div>
             </div>
          </div>
          <div className="flex flex-col items-end text-right">
             <div className="font-bold text-[16px] text-black">BJCL / {sauda.sauda_no}</div>
             <div className="text-[11px] font-bold text-black">Date: {sauda.date ? new Date(sauda.date).toLocaleDateString('en-GB') : ''}</div>
             <div className="text-[10px] font-mono text-black">P.O. : {sauda.po_type || 'Normal/PTF'}</div>
          </div>
       </div>

       {/* Parties Block */}
       <div className="flex flex-col gap-3 font-semibold mb-4 flex-none">
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Broker :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.broker || '').toUpperCase()}
             </span>
          </div>
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Supplier :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.supplier || '').toUpperCase()}
             </span>
          </div>
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Challan Supplier :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.challan_supplier || '').toUpperCase()}
             </span>
          </div>
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Area :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.area || '').toUpperCase()}
             </span>
          </div>
       </div>

       {/* Quantities & Logistics Block */}
       <div className="flex flex-col gap-3 font-semibold mb-4 flex-none">
          <div className="flex justify-between gap-6">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">No. of Lorries</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black text-[12px]">
                   {sauda.no_of_lorries || sauda.total_lorry || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Units/Lorry :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black uppercase">
                   {sauda.units_per_lorry_type || ''}
                </span>
             </div>
          </div>
          <div className="flex justify-between gap-6">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Total Unit :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.total_unit || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Wt/Lorry :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.wt_per_lorry || ''}
                </span>
             </div>
          </div>
          <div className="flex justify-between gap-6">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Unit :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black uppercase">
                   {sauda.unit_type || (sauda as any).unit || (sauda as any).unit_name || (sauda as any).unitType || 'BALES'}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Total Wt. :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black inline-flex justify-center items-center">
                   {sauda.total_wt_in_ton ? `${sauda.total_wt_in_ton} tons` : ''}
                </span>
             </div>
          </div>
       </div>

       {/* Qualities & Combinations Table (Agency | Marka | Quality * | Rs. *) */}
       <div className="mb-4 flex-none border-2 border-black rounded-xs overflow-hidden font-mono text-[11px]">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-neutral-100 border-b-2 border-black font-extrabold text-[11px] text-black">
                   <th className="border-r border-black px-2 py-1 text-left w-[28%] uppercase">Agency</th>
                   <th className="border-r border-black px-2 py-1 text-left w-[24%] uppercase">Marka</th>
                   <th className="border-r border-black px-2 py-1 text-left w-[24%] uppercase">Quality *</th>
                   <th className="px-2 py-1 text-right w-[24%] uppercase">Rs. *</th>
                </tr>
             </thead>
             <tbody>
                {paddedQualities.map((item, idx) => (
                   <tr key={idx} className="border-b border-black/30 last:border-b-0 h-5">
                      <td className="border-r border-black/30 px-2 py-0.5 font-bold uppercase truncate">
                         {item.agency ? item.agency.trim().toUpperCase() : ''}
                      </td>
                      <td className="border-r border-black/30 px-2 py-0.5 font-bold uppercase truncate">
                         {item.marka ? item.marka.trim().toUpperCase() : ''}
                      </td>
                      <td className="border-r border-black/30 px-2 py-0.5 font-extrabold uppercase truncate text-black">
                         {item.quality ? item.quality.trim().toUpperCase() : ''}
                      </td>
                      <td className="px-2 py-0.5 text-right font-bold text-black">
                         {item.rs && Number(item.rs) > 0 ? Number(item.rs).toLocaleString('en-IN') : ''}
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>

       {/* Terms Block */}
       <div className="flex flex-col gap-2.5 font-semibold mb-4 flex-none">
          <div className="flex gap-4 items-end">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Shipment :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.shipment_date ? new Date(sauda.shipment_date).toLocaleDateString('en-GB') : ''}
                </span>
             </div>
             <div className="flex w-28 items-end shrink-0">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Days :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.shipment_days || sauda.delivery_days || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Penalty :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.shipment_penalty ? `${sauda.shipment_penalty}/Per day` : '5/Per day'}
                </span>
             </div>
          </div>
          <div className="flex gap-4 items-end">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Marks Claim :</span>
                <span className="flex-1 border-b border-black border-dotted pb-0.5 font-bold text-black">
                   {sauda.marks_claim || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Quantity Claim :</span>
                <span className="flex-1 border-b border-black border-dotted pb-0.5 font-bold text-black font-mono">
                   {sauda.quantity_claim || ''}
                </span>
             </div>
          </div>
          <div className="flex items-start mt-1">
             <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Remarks :</span>
             <span className="flex-1 italic text-black font-semibold leading-snug">
                {sauda.remarks || 'Area, Agency Grade, Grade differential can change as per market.'} B.Rate - {getBrateString()} S. Date - {sauda.date ? new Date(sauda.date).toLocaleDateString('en-GB') : ''}
             </span>
          </div>
       </div>

       {/* Signatures & Footer Branding Area */}
       <div className="flex flex-col gap-2 mt-auto pt-4 mb-1 font-semibold flex-none font-sans border-t border-black/30">
          <div className="flex justify-between items-end">
             <div className="text-left pl-1">
                <p className="text-black font-bold text-[11px]">Superior / Normal (Marks)</p>
             </div>
             <div className="text-center w-40">
                <div className="w-32 border-t border-black mb-1 mx-auto"></div>
                <p className="text-black font-bold text-[11px]">Signature</p>
             </div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono text-neutral-600 pt-1">
             <div>BALLY JUTE CO. LTD. • AUTHORIZED COMPUTER GENERATED SYSTEM CONTRACT</div>
             <div>Page 1 of 1</div>
          </div>
       </div>
    </div>
  );
}
