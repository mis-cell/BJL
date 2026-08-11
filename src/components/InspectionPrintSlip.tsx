import React from 'react';

interface DetailRow {
  srl_no: number;
  arrival_grade?: string;
  stock_grade_code?: string;
  stock_grade_name?: string;
  area?: string;
  agency?: string;
  marka?: string;
  crop_year?: string;
  lot?: string;
  quantity?: number | string;
  unit?: string;
  challan_gross_wt?: number | string;
}

interface InspectionData {
  mr_no: string;
  mr_date: string;
  arrival_no?: string;
  arrival_date?: string;
  po_no?: string;
  po_date?: string;
  broker_name?: string;
  supplier_name?: string;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  detention_days?: number;
  unloading_date?: string;
  mill_po_no?: string;
  mill_po_date?: string;
  mr_spcl_print?: string;
  remarks?: string;
  delivery_claim?: number;
  deduction_type?: string;
  deduction_amount?: number;
}

interface Props {
  master: InspectionData;
  details: DetailRow[];
}

export default function InspectionPrintSlip({ master, details }: Props) {
  // Pad details to at least 12 rows for standard A4 Portrait balance
  const paddedDetails = [...details];
  while (paddedDetails.length < 12) {
    paddedDetails.push({
      srl_no: paddedDetails.length + 1,
      arrival_grade: "",
      stock_grade_name: "",
      area: "",
      agency: "",
      marka: "",
      crop_year: "",
      lot: "",
      quantity: "",
      unit: "",
      challan_gross_wt: ""
    });
  }

  // Calculate totals
  const totalBales = details.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalWeight = details.reduce((sum, item) => sum + (Number(item.challan_gross_wt) || 0), 0);

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-[#525659] p-4 sm:p-8 min-h-[315mm] print:min-h-0 print:h-auto flex justify-center items-center print:block print:bg-white print:p-0 font-mono select-text w-full overflow-x-auto">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-sheet {
            width: 210mm !important;
            height: 297mm !important; /* Standard A4 portrait layout */
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 12mm 15mm !important;
            margin: 0 auto !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
        .dotted-line-value {
          border-bottom: 1px dotted #000;
          padding-bottom: 2px;
        }
      `}</style>

      {/* Main continuous paper template wrapper */}
      <div className="print-full-sheet w-[210mm] min-h-[297mm] max-h-[297mm] bg-[#fbf9f4] shadow-2xl border border-gray-400 p-8 flex select-text text-black shrink-0 relative overflow-hidden print:shadow-none print:border-none print:bg-white box-sizing:border-box">
        
        {/* Left Sprocket Feed Holes */}
        <div className="w-[32px] bg-transparent border-r border-dotted border-gray-400 flex flex-col justify-between py-6 shrink-0  pr-3 mr-3 print:hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 bg-gray-300 rounded-full mx-auto shadow-inner border border-gray-400 opacity-60"></div>
          ))}
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col justify-between text-[11px] leading-relaxed">
          
          {/* Document Header */}
          <div>
            <div className="flex justify-between items-start ">
              <div className="text-left w-2/3">
                <h1 className="font-sans font-black text-lg tracking-tight text-red-600 leading-none">BALLY JUTE COMPANY LIMITED</h1>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wide mt-1">AUTHORIZED MILL PREMISES</p>
              </div>
              <div className="text-right w-1/3">
                <span className="font-black text-[11px] text-red-700 uppercase border-2 border-red-600 px-2.5 py-0.5 tracking-widest font-mono">QUALITY AUDIT</span>
                <p className="text-[9px] font-bold text-gray-500 mt-1 font-mono">Form No: JMCL-MR-INSP</p>
              </div>
            </div>

            <div className="text-center my-2 border-y-2 border-double border-red-650 py-1">
              <h2 className="font-serif font-black text-sm tracking-widest text-[#0d47a1] uppercase">MILLED MATERIAL QUALITY INSPECTION & CLAIM REPORT</h2>
            </div>

            {/* Document Meta (Reference keys row-by-row) */}
            <div className="grid grid-cols-3 gap-y-1 my-3 font-semibold text-slate-900">
              <div className="flex">
                <span className="w-24 shrink-0 font-bold">M.R. No:</span>
                <span className="flex-1 font-black text-[#0d47a1] uppercase">{master.mr_no}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 font-bold">M.R. Date:</span>
                <span className="flex-1 font-mono">{formatDateLabel(master.mr_date)}</span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0 font-bold">Unloading Date:</span>
                <span className="flex-1 font-mono">{formatDateLabel(master.unloading_date)}</span>
              </div>

              <div className="flex">
                <span className="w-24 shrink-0 font-bold">Arrival No:</span>
                <span className="flex-1 uppercase font-bold text-stone-750">{master.arrival_no || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 font-bold">Arrival Date:</span>
                <span className="flex-1 font-mono">{formatDateLabel(master.arrival_date)}</span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0 font-bold">Detention Days:</span>
                <span className="flex-1 font-mono">{master.detention_days ?? 0} Days</span>
              </div>

              <div className="flex">
                <span className="w-24 shrink-0 font-bold">P.O. Ref:</span>
                <span className="flex-1 uppercase font-bold">{master.po_no || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-24 shrink-0 font-bold">P.O. Date:</span>
                <span className="flex-1 font-mono">{formatDateLabel(master.po_date)}</span>
              </div>
              <div className="flex col-span-1">
                <span className="w-28 shrink-0 font-bold">Mill P.O.:</span>
                <span className="flex-1 uppercase font-bold">{master.mill_po_no || '-'}</span>
              </div>
            </div>

            {/* Horizontal partition */}
            <hr className="border-t border-gray-400 my-2 " />

            {/* Supplier / Broker Information Group */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 my-2">
              <div className="flex items-center">
                <span className="w-40 shrink-0 font-bold">Supplier / Merchant :</span>
                <span className="flex-1 dotted-line-value font-black uppercase text-[11.5px] truncate">{(master.supplier_name || '').toUpperCase()}</span>
              </div>
              <div className="flex items-center">
                <span className="w-32 shrink-0 font-bold">Broker Partner :</span>
                <span className="flex-1 dotted-line-value font-black uppercase text-[11.5px] truncate">{(master.broker_name || '').toUpperCase()}</span>
              </div>
            </div>

            {/* Horizontal partition */}
            <hr className="border-t border-gray-400 my-2 " />

            {/* Key Quality Parameters Summary (In a Boxed Layout) */}
            <div className="bg-[#f0ece4] border border-gray-400 p-2 my-2.5 rounded-sm">
              <div className="text-[10px] font-bold uppercase tracking-tight text-slate-800 mb-1 flex items-center gap-1">
                <span>⚡ AUDITED QUALITY PARAMETERS DIFFERENTIAL STATS :</span>
              </div>
              <div className="grid grid-cols-3 gap-y-1 gap-x-6 text-[10.5px]">
                {/* Moisture */}
                <div className="flex justify-between border-r border-gray-300 pr-4">
                  <span className="font-bold">MOISTURE RATING :</span>
                  <span className="font-mono">Actual: <b className="text-indigo-900">{master.actual_moisture || 0}%</b> | Claim: <b className="text-red-700">{master.claim_moisture || 0}%</b></span>
                </div>
                {/* Dust */}
                <div className="flex justify-between border-r border-gray-300 px-4">
                  <span className="font-bold">WEFT DUST RATIO :</span>
                  <span className="font-mono">Actual: <b className="text-indigo-900">{master.actual_dust || 0}%</b> | Claim: <b className="text-red-700">{master.claim_dust || 0}%</b></span>
                </div>
                {/* NCV */}
                <div className="flex justify-between pl-4">
                  <span className="font-bold">NCV RATING % :</span>
                  <span className="font-mono">Actual: <b className="text-indigo-900">{master.actual_ncv || 0}%</b> | Claim: <b className="text-red-700">{master.claim_ncv || 0}%</b></span>
                </div>
              </div>
            </div>

            {/* Detail Rows Grid Table */}
            <div className="border border-black mt-2 bg-white">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-center font-bold uppercase ">
                    <th className="px-2 py-0.5 border-r border-black w-8">SL.</th>
                    <th className="px-2 py-0.5 border-r border-black w-24">Grade (Stock/Recpt)</th>
                    <th className="px-3 py-0.5 border-r border-black">Area / Zone</th>
                    <th className="px-3 py-0.5 border-r border-black">Agency</th>
                    <th className="px-2 py-0.5 border-r border-black w-24">Marka / Code</th>
                    <th className="px-2 py-0.5 border-r border-black w-14">Crop Yr</th>
                    <th className="px-2 py-0.5 border-r border-black w-16">Lot No</th>
                    <th className="px-2 py-0.5 border-r border-black w-16 text-right">Quantity</th>
                    <th className="px-1 py-0.5 border-r border-black w-12 text-center">Unit</th>
                    <th className="px-2 py-0.5 text-right w-20">Gross Wt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 font-semibold text-slate-800">
                  {paddedDetails.map((row, idx) => (
                    <tr key={idx} className="h-4.5 font-mono">
                      <td className="px-2 text-center border-r border-gray-300  text-[9.5px]">{row.srl_no}</td>
                      <td className="px-2 border-r border-gray-300 uppercase text-[9.5px]">
                        {row.stock_grade_code ? `${row.stock_grade_code} - ${row.stock_grade_name || ''}` : (row.arrival_grade || '')}
                      </td>
                      <td className="px-3 border-r border-gray-300 uppercase text-[9.5px] truncate max-w-[120px]">{row.area || ''}</td>
                      <td className="px-3 border-r border-gray-300 uppercase text-[9.5px] truncate max-w-[120px]">{row.agency || ''}</td>
                      <td className="px-2 border-r border-gray-300 uppercase text-[9.5px] text-center">{row.marka || ''}</td>
                      <td className="px-2 border-r border-gray-300 text-center  text-[9.5px]">{row.crop_year || ''}</td>
                      <td className="px-2 border-r border-gray-300 text-center uppercase text-[9.5px]">{row.lot || ''}</td>
                      <td className="px-2 border-r border-gray-300 text-right font-bold text-stone-900">{(row.quantity !== "" && row.quantity != null) ? Number(row.quantity).toLocaleString() : ''}</td>
                      <td className="px-1 border-r border-gray-300 text-center uppercase">{(row.quantity !== "" && row.quantity != null) ? (row.unit || 'BALES') : ''}</td>
                      <td className="px-2 text-right font-bold text-stone-900">{row.challan_gross_wt ? Number(row.challan_gross_wt).toFixed(2) : ''}</td>
                    </tr>
                  ))}
                  {/* Totals Summary Row */}
                  <tr className="bg-gray-50 border-t border-black font-extrabold text-[#0d47a1]">
                    <td colSpan={7} className="px-3 text-right uppercase py-1">TOTAL AUDITED QUANTITY SUMMARY :</td>
                    <td className="px-2 text-right font-black border-r border-gray-300">{totalBales !== undefined ? totalBales.toLocaleString() : '-'}</td>
                    <td className="px-1 text-center border-r border-gray-300">BALES</td>
                    <td className="px-2 text-right font-black">{totalWeight !== undefined && totalWeight !== 0 ? totalWeight.toFixed(2) : (totalWeight === 0 ? '0.00' : '-')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Special Instructions & Remarks Row */}
            <div className="grid grid-cols-12 gap-2 mt-2 items-start">
              <div className="col-span-8 flex items-start gap-1 font-semibold text-slate-800">
                <span className="font-bold shrink-0">Remarks / Clause :</span>
                <p className="italic text-gray-700 leading-snug">{master.remarks || 'No negative qualities deviations noted regarding moisture or weft weights.'}</p>
              </div>
              <div className="col-span-4 flex items-start gap-1 font-semibold text-slate-800 justify-end">
                <span className="font-bold shrink-0">Print Ref:</span>
                <span className="font-mono text-stone-600 truncate">{master.mr_spcl_print || 'STANDARD_OFFICE'}</span>
              </div>
            </div>
          </div>

          {/* Audit Signatures */}
          <div className="flex justify-between items-end mt-4 ">
            <div className="text-left">
              <p className="text-[10px] text-gray-500 font-bold uppercase italic">* System-Registered Audit Copy *</p>
            </div>
            <div className="flex gap-16 text-center text-[10.5px]">
              <div>
                <div className="w-28 border-t border-black mb-1"></div>
                <p className="font-bold">Milled Inspector</p>
              </div>
              <div>
                <div className="w-28 border-t border-black mb-1"></div>
                <p className="font-bold">Works Manager</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Sprocket Feed Holes */}
        <div className="w-[32px] bg-transparent border-l border-dotted border-gray-400 flex flex-col justify-between py-6 shrink-0  pl-3 ml-3 print:hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 bg-gray-300 rounded-full mx-auto shadow-inner border border-gray-400 opacity-60"></div>
          ))}
        </div>

      </div>
    </div>
  );
}
