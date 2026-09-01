import React from 'react';

export interface InspectionDetailPrintRow {
  crop_year?: string;
  marka?: string;
  marks?: string;
  arrival_grade?: string;
  stock_grade_code?: string;
  stock_grade_name?: string;
  quantity?: number | string;
  unit?: string;
  claim?: string | number;
  challan_gross_wt?: number | string;
  gross_weight_batch?: number | string;
  receipt_gross_wt?: number | string;
  weight_mt?: number | string;
  moisture_act?: number | string;
  actual_moisture?: number | string;
  moisture_deduction_kg?: number | string;
  dust_act?: number | string;
  actual_dust?: number | string;
  dust_deduction_kg?: number | string;
  ncv_act?: number | string;
  actual_ncv?: number | string;
  ncv_deduction_kg?: number | string;
  final_receipt_wt?: number | string;
  net_wt?: number | string;
  settlement_grade_down?: number | string;
  settlement_moisture?: number | string;
  settlement_dust?: number | string;
  settlement_ncv?: number | string;
  premium?: string | number;
  tolerable?: string;
  rate?: number | string;
  rate_qntl?: number | string;
  area?: string;
  agency?: string;
  lot?: string;
}

export interface InspectionMasterPrintData {
  mr_no: string;
  mr_date?: string;
  arrival_no?: string;
  arrival_date?: string;
  po_no?: string;
  po_date?: string;
  mill_po_no?: string;
  mill_po_date?: string;
  supplier_name?: string;
  broker_name?: string;
  lorry_number?: string;
  vehicle_no?: string;
  challan_no?: string;
  challan_date?: string;
  station?: string;
  area?: string;
  remarks?: string;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  detention_days?: number;
  unloading_date?: string;
  mr_spcl_print?: string;
  status?: string;
}

interface Props {
  master: InspectionMasterPrintData;
  details?: InspectionDetailPrintRow[];
}

export default function InspectionPrintSlip({ master, details = [] }: Props) {
  // Format date helper: DD/MM/YYYY
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB');
    } catch {
      return dateStr;
    }
  };

  // If details are empty, create at least 1 row from master values
  const effectiveDetails: InspectionDetailPrintRow[] = details.length > 0 ? details : [
    {
      crop_year: '2026-27',
      marka: master.area || 'BJC',
      stock_grade_name: 'TD-5',
      quantity: 1,
      challan_gross_wt: '',
      actual_moisture: master.actual_moisture,
      actual_dust: master.actual_dust,
      actual_ncv: master.actual_ncv,
      rate: ''
    }
  ];

  // Pad rows to at least 9 rows so the grid matches continuous feed stationery exactly
  const targetRowCount = Math.max(9, effectiveDetails.length);
  const paddedRows: (InspectionDetailPrintRow | null)[] = [...effectiveDetails];
  while (paddedRows.length < targetRowCount) {
    paddedRows.push(null);
  }

  // Calculate totals
  const totalQuantity = effectiveDetails.reduce((sum, r) => sum + (Number(r?.quantity) || 0), 0);
  const totalGrossWt = effectiveDetails.reduce((sum, r) => {
    const wt = Number(r?.challan_gross_wt ?? r?.gross_weight_batch ?? r?.receipt_gross_wt ?? r?.weight_mt ?? 0);
    return sum + wt;
  }, 0);

  const totalMoistureKg = effectiveDetails.reduce((sum, r) => sum + (Number(r?.moisture_deduction_kg) || 0), 0);
  const totalDustKg = effectiveDetails.reduce((sum, r) => sum + (Number(r?.dust_deduction_kg) || 0), 0);
  const totalNcvKg = effectiveDetails.reduce((sum, r) => sum + (Number(r?.ncv_deduction_kg) || 0), 0);

  const totalNetWt = effectiveDetails.reduce((sum, r) => {
    const net = Number(r?.final_receipt_wt ?? r?.net_wt ?? 0);
    return sum + net;
  }, 0);

  return (
    <div className="bg-[#525659] p-3 sm:p-6 min-h-[300mm] print:min-h-0 print:h-auto flex justify-center items-center print:block print:bg-white print:p-0 font-sans select-text w-full overflow-x-auto">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: #d60000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-stationery-sheet {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 10mm 12mm !important;
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
      `}</style>

      {/* CONTINUOUS STATIONERY FORM WRAPPER */}
      <div className="print-stationery-sheet w-[210mm] min-h-[297mm] bg-[#ffffff] shadow-2xl border border-red-200 p-6 flex select-text shrink-0 relative overflow-hidden print:shadow-none print:border-none print:bg-white box-sizing:border-box text-[#d60000]">
        
        {/* Left Sprocket Feed Holes */}
        <div className="w-[28px] bg-transparent flex flex-col justify-between py-4 shrink-0 pr-2 mr-2 select-none print:hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 bg-slate-100 rounded-full mx-auto shadow-inner border border-red-300/60 opacity-70"></div>
          ))}
        </div>

        {/* Form Body Canvas */}
        <div className="flex-1 flex flex-col justify-between text-[11px] leading-tight font-sans">
          <div>
            {/* Top Row: Title, Mill Copy, Company Header */}
            <div className="relative mb-2">
              {/* Mill Copy top right */}
              <div className="absolute right-0 top-0 text-right">
                <span className="font-extrabold text-sm sm:text-base text-[#d60000] tracking-wider uppercase">
                  MILL COPY
                </span>
              </div>

              {/* Center Main Heading */}
              <div className="text-center pt-1 pb-1">
                <h1 className="font-extrabold text-xl sm:text-2xl text-[#d60000] tracking-wider uppercase">
                  MARKS & QUALITY RECEIVED
                </h1>
              </div>

              {/* Company Info Left */}
              <div className="mt-1">
                <h2 className="font-black text-lg sm:text-xl text-[#d60000] tracking-tight uppercase leading-none">
                  BALLY JUTE COMPANY LTD.
                </h2>
                <p className="text-[11.5px] font-semibold text-[#d60000] mt-0.5">
                  5, Sree Charan Sarani, Bally, West Bengal.
                </p>
              </div>
            </div>

            {/* Header Metadata Fields with Underlines */}
            <div className="space-y-1.5 mt-2 mb-3 text-[11px] font-bold text-[#d60000]">
              {/* Line 1: From */}
              <div className="flex items-end">
                <span className="shrink-0 font-extrabold mr-2 text-xs">From :</span>
                <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 font-bold text-xs uppercase text-[#d60000] truncate">
                  {master.supplier_name || ''}
                </span>
              </div>

              {/* Line 2: M.R.No., Date, Order No., Date */}
              <div className="grid grid-cols-12 gap-x-2 items-end">
                <div className="col-span-3 flex items-end">
                  <span className="shrink-0 font-extrabold mr-1.5">M.R.No. :</span>
                  <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 font-bold uppercase font-mono truncate">
                    {master.mr_no || ''}
                  </span>
                </div>

                <div className="col-span-3 flex items-end">
                  <span className="shrink-0 font-extrabold mr-1.5">Date :</span>
                  <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 font-bold font-mono truncate">
                    {formatDate(master.mr_date || master.arrival_date)}
                  </span>
                </div>

                <div className="col-span-3 flex items-end">
                  <span className="shrink-0 font-extrabold mr-1.5">Order No. :</span>
                  <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 font-bold uppercase font-mono truncate">
                    {master.po_no || master.mill_po_no || ''}
                  </span>
                </div>

                <div className="col-span-3 flex items-end">
                  <span className="shrink-0 font-extrabold mr-1.5">Date :</span>
                  <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 font-bold font-mono truncate">
                    {formatDate(master.po_date || master.mill_po_date || master.mr_date)}
                  </span>
                </div>
              </div>
            </div>

            {/* MARKS & QUALITY RECEIVED GRID TABLE */}
            <div className="border-2 border-[#d60000] bg-white mt-2 overflow-hidden">
              <table className="w-full border-collapse text-[10px] text-center">
                <thead>
                  {/* Top Header Row */}
                  <tr className="bg-[#d60000] text-white font-extrabold uppercase text-[9.5px]">
                    <th rowSpan={2} className="border-r border-b border-white px-1 py-1 w-12">Crop</th>
                    <th rowSpan={2} className="border-r border-b border-white px-1 py-1 w-12">Mark</th>
                    <th rowSpan={2} className="border-r border-b border-white px-1 py-1 w-14">Quality</th>
                    <th rowSpan={2} className="border-r border-b border-white px-1 py-1 w-12">Quantity</th>
                    <th rowSpan={2} className="border-r border-b border-white px-1 py-1 w-10">Claim</th>
                    <th rowSpan={2} className="border-r border-b border-white px-1 py-1 w-14">Gross Wt.</th>
                    <th colSpan={2} className="border-r border-b border-white px-1 py-0.5">Moisture</th>
                    <th colSpan={2} className="border-r border-b border-white px-1 py-0.5">Dust</th>
                    <th colSpan={2} className="border-r border-b border-white px-1 py-0.5">NCV</th>
                    <th rowSpan={2} className="border-r border-b border-white px-1 py-1 w-14">Net Wt.</th>
                    <th colSpan={4} className="border-r border-b border-white px-1 py-0.5">Settlement</th>
                    <th rowSpan={2} className="border-b border-white px-1 py-1 w-12">Rate</th>
                  </tr>
                  {/* Sub-header Row */}
                  <tr className="bg-[#d60000] text-white font-extrabold uppercase text-[8.5px]">
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-7">%</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-7">Kg.</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-7">%</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-7">Kg.</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-7">%</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-7">Kg.</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-11">Grade</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-11">Moisture</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-9">Dust</th>
                    <th className="border-r border-b border-white px-0.5 py-0.5 w-12">Prem./Less</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#d60000] font-bold text-[#d60000]">
                  {paddedRows.map((row, idx) => {
                    if (!row) {
                      return (
                        <tr key={idx} className="h-6">
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td className="border-r border-[#d60000]"></td>
                          <td></td>
                        </tr>
                      );
                    }

                    const grossWt = Number(row.challan_gross_wt ?? row.gross_weight_batch ?? row.receipt_gross_wt ?? row.weight_mt ?? 0);
                    const netWt = Number(row.final_receipt_wt ?? row.net_wt ?? 0);
                    const moistPct = row.moisture_act ?? row.actual_moisture ?? (master.actual_moisture ? `${master.actual_moisture}%` : '');
                    const dustPct = row.dust_act ?? row.actual_dust ?? (master.actual_dust ? `${master.actual_dust}%` : '');
                    const ncvPct = row.ncv_act ?? row.actual_ncv ?? (master.actual_ncv ? `${master.actual_ncv}%` : '');

                    return (
                      <tr key={idx} className="h-6">
                        {/* Crop */}
                        <td className="border-r border-[#d60000] px-1 font-mono text-[9px] truncate">
                          {row.crop_year || '2026-27'}
                        </td>
                        {/* Mark */}
                        <td className="border-r border-[#d60000] px-1 font-mono uppercase text-[9px] truncate">
                          {row.marka || row.marks || master.area || ''}
                        </td>
                        {/* Quality */}
                        <td className="border-r border-[#d60000] px-1 font-bold uppercase text-[9px] truncate">
                          {row.stock_grade_name || row.arrival_grade || row.stock_grade_code || 'TD-5'}
                        </td>
                        {/* Quantity */}
                        <td className="border-r border-[#d60000] px-1 font-mono text-[9.5px]">
                          {row.quantity !== undefined && row.quantity !== '' ? row.quantity : ''}
                        </td>
                        {/* Claim */}
                        <td className="border-r border-[#d60000] px-1 font-mono text-[9px]">
                          {row.claim || '-'}
                        </td>
                        {/* Gross Wt. */}
                        <td className="border-r border-[#d60000] px-1 font-mono text-[9.5px]">
                          {grossWt > 0 ? grossWt.toFixed(2) : ''}
                        </td>
                        {/* Moisture % */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {moistPct ? `${moistPct}${typeof moistPct === 'number' ? '%' : ''}` : ''}
                        </td>
                        {/* Moisture Kg. */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {row.moisture_deduction_kg ? Number(row.moisture_deduction_kg).toFixed(1) : ''}
                        </td>
                        {/* Dust % */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {dustPct ? `${dustPct}${typeof dustPct === 'number' ? '%' : ''}` : ''}
                        </td>
                        {/* Dust Kg. */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {row.dust_deduction_kg ? Number(row.dust_deduction_kg).toFixed(1) : ''}
                        </td>
                        {/* NCV % */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {ncvPct ? `${ncvPct}${typeof ncvPct === 'number' ? '%' : ''}` : ''}
                        </td>
                        {/* NCV Kg. */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {row.ncv_deduction_kg ? Number(row.ncv_deduction_kg).toFixed(1) : ''}
                        </td>
                        {/* Net Wt. */}
                        <td className="border-r border-[#d60000] px-1 font-mono text-[9.5px]">
                          {netWt > 0 ? netWt.toFixed(2) : (grossWt > 0 ? grossWt.toFixed(2) : '')}
                        </td>
                        {/* Settlement Grade */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {row.settlement_grade_down || ''}
                        </td>
                        {/* Settlement Moisture */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {row.settlement_moisture || ''}
                        </td>
                        {/* Settlement Dust */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {row.settlement_dust || ''}
                        </td>
                        {/* Settlement Prem./Less */}
                        <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                          {row.premium || ''}
                        </td>
                        {/* Rate */}
                        <td className="px-1 font-mono text-[9px]">
                          {row.rate || row.rate_qntl || ''}
                        </td>
                      </tr>
                    );
                  })}

                  {/* TOTAL ROW */}
                  <tr className="bg-[#ffe8e8] font-extrabold text-[#d60000] h-6 border-t-2 border-[#d60000]">
                    <td colSpan={3} className="border-r border-[#d60000] px-2 text-left uppercase tracking-wider text-[10px]">
                      TOTAL
                    </td>
                    <td className="border-r border-[#d60000] px-1 font-mono text-[9.5px]">
                      {totalQuantity > 0 ? totalQuantity : ''}
                    </td>
                    <td className="border-r border-[#d60000] px-1 font-mono text-[9px]">-</td>
                    <td className="border-r border-[#d60000] px-1 font-mono text-[9.5px]">
                      {totalGrossWt > 0 ? totalGrossWt.toFixed(2) : ''}
                    </td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">-</td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                      {totalMoistureKg > 0 ? totalMoistureKg.toFixed(1) : ''}
                    </td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">-</td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                      {totalDustKg > 0 ? totalDustKg.toFixed(1) : ''}
                    </td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">-</td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]">
                      {totalNcvKg > 0 ? totalNcvKg.toFixed(1) : ''}
                    </td>
                    <td className="border-r border-[#d60000] px-1 font-mono text-[9.5px]">
                      {totalNetWt > 0 ? totalNetWt.toFixed(2) : (totalGrossWt > 0 ? totalGrossWt.toFixed(2) : '')}
                    </td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]"></td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]"></td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]"></td>
                    <td className="border-r border-[#d60000] px-0.5 font-mono text-[9px]"></td>
                    <td className="px-1 font-mono text-[9px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Remarks Row */}
            <div className="mt-2.5 flex items-start text-[11px] font-bold text-[#d60000]">
              <span className="shrink-0 font-extrabold mr-2 text-xs">Remarks:</span>
              <p className="flex-1 font-semibold text-xs text-[#d60000] min-h-[18px] leading-snug">
                {master.remarks || ''}
              </p>
            </div>

            {/* Boxed Information Section (Challan No & Date, Vehicle, Stations) */}
            <div className="mt-3 border-2 border-[#d60000] p-2 bg-white text-[11px] font-bold text-[#d60000]">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4 flex items-center">
                  <span className="shrink-0 font-extrabold mr-1.5">Challan No & Date :</span>
                  <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 font-mono truncate">
                    {master.challan_no ? `${master.challan_no} ${master.challan_date ? `& ${formatDate(master.challan_date)}` : ''}` : (master.arrival_no ? `${master.arrival_no} & ${formatDate(master.arrival_date)}` : '')}
                  </span>
                </div>

                <div className="col-span-4 flex items-center">
                  <span className="shrink-0 font-extrabold mr-1.5">Vehicle :</span>
                  <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 font-mono uppercase truncate">
                    {master.lorry_number || master.vehicle_no || ''}
                  </span>
                </div>

                <div className="col-span-4 flex items-center">
                  <span className="shrink-0 font-extrabold mr-1.5">Stations :</span>
                  <span className="flex-1 border-b border-[#d60000] pb-0.5 px-1 uppercase truncate">
                    {master.station || master.area || 'BALLY MILL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Footer Section with Notes & Authorized Signatory */}
            <div className="mt-2 border-t border-[#d60000] pt-2 grid grid-cols-12 gap-3 text-[#d60000]">
              {/* Left Side: Legal Notes */}
              <div className="col-span-8 pr-3 border-r border-[#d60000] text-[9.5px] leading-tight space-y-1">
                <p className="font-extrabold text-[10px]">Note:</p>
                <p className="font-semibold text-justify">
                  1. Initiate your offer of settlement at an early date failing which we shall refer the matter to B.C.C.I for arbitrator.
                </p>
                <p className="font-semibold text-justify">
                  2. Seller must remove the bales within three days from the date of serving the Mill Receipt if the rates given on the Mill Receipt by the Buyers are not acceptable to them, failing which Buyer will treat the consignment as having been accepted and will not be responsible for its being used up.
                </p>
                <p className="font-extrabold text-[10.5px] tracking-wide pt-0.5 uppercase">
                  ORIGINAL MUST BE ATTACHED WITH BILL/COPY
                </p>
              </div>

              {/* Right Side: Company Signatory Box */}
              <div className="col-span-4 flex flex-col justify-between items-center text-center pl-2">
                <p className="font-extrabold text-[11px] uppercase tracking-wide">
                  For, BALLY JUTE COMPANY LTD.
                </p>
                
                <div className="w-full pt-10">
                  <div className="w-40 mx-auto border-t border-[#d60000] mb-1"></div>
                  <p className="font-extrabold text-[10.5px] tracking-wider uppercase">
                    Authorised Signatory
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Sprocket Feed Holes */}
        <div className="w-[28px] bg-transparent flex flex-col justify-between py-4 shrink-0 pl-2 ml-2 select-none print:hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 bg-slate-100 rounded-full mx-auto shadow-inner border border-red-300/60 opacity-70"></div>
          ))}
        </div>

      </div>
    </div>
  );
}
