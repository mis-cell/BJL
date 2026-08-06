import React from 'react';

interface PoDetailItem {
  srl: number;
  crop: string;
  grade_code: string;
  grade_name: string;
  agency_code: string;
  agency_name: string;
  marka_code: string;
  marka_name: string;
  qty: number;
  weight: number;
  rate: number;
}

interface PurchaseOrderData {
  no: string;
  ptf_no: string;
  is_ptf: boolean;
  date: string;
  broker: string;
  supplier: string;
  challan_supplier: string;
  area: string;
  trans_paid_by: string;
  weight_unit_kgs: string;
  against_cancellation: string;
  purchase_unit_name: string;
  total_no_of_lorries: string;
  units_per_lorry: string;
  total_units: string;
  weight_per_lorry: string;
  total_contract_mt: string;
  marka_type: string;
  marka_penalty: string;
  qty_penalty: string;
  delivery_from: string;
  delivery_to: string;
  grace_days: string;
  delivery_penalty: string;
  contract_po_no: string;
  contract_date: string;
  rate_detail: string;
  delivery_schedule: string;
  terms_condition: string;
  remarks: string;
  po_identification: string;
  b_rate: string;
  s_date: string;
  items: PoDetailItem[];
}

interface Props {
  po: PurchaseOrderData;
}

// Helper to convert small integer number of lorries to descriptive word format (e.g., 1 -> ONE, 2 -> TWO)
const numberToWords = (num: number): string => {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  if (num === 0) return 'ZERO';
  if (num < 20) return ones[num];
  const tenPart = tens[Math.floor(num / 10)];
  const onePart = ones[num % 10];
  return `${tenPart}${onePart ? ' ' + onePart : ''}`;
};

export default function PoPrintSlip({ po }: Props) {
  const detailRows = po.items || [];
  
  // Format dates strictly into exact 2-digit typewriter style: DD/MM/YYYY
  const formatDateDotMatrix = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const poDisplayNo = po.is_ptf ? po.ptf_no : po.no || 'BJCL-MANUAL';

  // Align details nicely with clean spacer lines
  const paddedItems = [...detailRows];
  while (paddedItems.length < 5) {
    paddedItems.push({
      srl: paddedItems.length + 1,
      crop: '',
      grade_code: '',
      grade_name: '',
      agency_code: '',
      agency_name: '',
      marka_code: '',
      marka_name: '',
      qty: 0,
      weight: 0,
      rate: 0
    });
  }

  // Pre-generate 14 continuous paper sprocket feedback holes for portrait presentation
  const sprocketHoles = Array.from({ length: 13 });

  // Ensure trailing dot on Quality descriptor just like in the scanned physical copy
  const formatQualityName = (name: string) => {
    if (!name) return '';
    const trimmed = name.trim();
    if (trimmed.endsWith('.')) return trimmed;
    return `${trimmed}.`;
  };

  return (
    <div className="bg-[#525659] p-4 sm:p-8 min-h-[190mm] flex justify-center items-center print:bg-white print:p-0 font-mono select-text w-full overflow-x-auto">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-full-sheet {
            width: 210mm !important;
            height: 165mm !important;
            min-height: 165mm !important;
            max-height: 165mm !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .sprocket-strip {
            display: flex !important;
          }
        }
        .dot-matrix-text {
          font-family: 'Courier New', Courier, Monaco, monospace;
          letter-spacing: -0.1px;
        }
      `}</style>

      {/* Main Continuous Form Sheet Container (Width = A4 portrait 210mm, Height optimized to fit exactly 165mm) */}
      <div className="print-full-sheet bg-white w-[210mm] max-w-[210mm] min-h-[165mm] h-[165mm] max-h-[165mm] flex flex-row border border-neutral-300 shadow-xl relative overflow-hidden text-black text-[11px] leading-relaxed select-text dot-matrix-text">
        
        {/* Left Hand Sprocket Margin Strip */}
        <div className="sprocket-strip w-[13mm] min-w-[13mm] flex flex-col justify-around items-center bg-white border-r border-dotted border-neutral-300 py-3  relative z-10">
          {sprocketHoles.map((_, idx) => (
            <div 
              key={`left-hole-${idx}`} 
              className="w-3 h-3 rounded-full border border-neutral-300 bg-neutral-50 flex items-center justify-center text-[5px]"
            >
            </div>
          ))}
        </div>

        {/* Core Jute Mill Slip Workspace (Print Content Area Width = ~184mm) */}
        <div className="flex-1 px-5 py-3 flex flex-col justify-between overflow-hidden">
          
          {/* Top Address & Header Layout */}
          <div>
            <div className="flex justify-between items-start text-[11px]">
              <span className="font-bold tracking-wider">{po.po_identification || 'DR/4-2'}</span>
              <span className="font-bold text-[14px] text-center tracking-wide pr-8">RAW JUTE PURCHASE ORDER</span>
              <span className="text-[10px] text-white ">.</span>
            </div>

            <div className="flex justify-between items-start mt-1 pb-1 text-[11.5px]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded border-2 border-black flex items-center justify-center font-serif font-black text-xs text-black shrink-0">
                  BJ
                </div>
                <div className="leading-tight">
                  <div className="font-extrabold text-[13px]">BALLY JUTE COMPANY LIMITED</div>
                  <div className="font-normal text-[10px] uppercase">AUTHORIZED MILL PREMISES, ESTD. 1979</div>
                  <div className="font-normal text-[10px] uppercase">HOWRAH, WEST BENGAL • RAW JUTE DIVISION</div>
                </div>
              </div>
              <div className="text-right leading-relaxed font-bold whitespace-pre pr-2">
                <div>Order No : {poDisplayNo}</div>
                <div>Date     : {formatDateDotMatrix(po.date)}</div>
              </div>
            </div>

            {/* Parties Details Section */}
            <div className="mt-3 text-[11.5px] leading-relaxed">
              <div className="flex">
                <span className="font-normal shrink-0">Broker's Name           :</span>
                <span className="font-extrabold uppercase">{(po.broker || 'N/A').toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-1">
                  <span className="font-normal shrink-0">Supplier Name           :</span>
                  <span className="font-extrabold uppercase">{(po.supplier || 'N/A').toUpperCase()}</span>
                </div>
                <div className="pl-4 font-bold text-[10.5px] shrink-0 pr-2">
                  JC Registration No: WBK00S202201929
                </div>
              </div>
              <div className="flex">
                <span className="font-normal shrink-0">Challan Supplier Name   :</span>
                <span className="font-extrabold uppercase">{(po.challan_supplier || po.supplier || 'N/A').toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Core spreadsheet details Table */}
          <div className="flex-1 flex flex-col justify-start mt-2">
            {/* Header dashed separator */}
            <div className="border-t border-dashed border-neutral-950 w-full my-0.5"></div>
            
            {/* Minimalist table with aligned typewriter text spacing columns */}
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="font-bold text-[11px] leading-6">
                  <th className="w-[8%] text-left font-bold">Lorries</th>
                  <th className="w-[12%] text-left font-bold">Crop Year</th>
                  <th className="w-[20%] text-left font-bold">Agency</th>
                  <th className="w-[20%] text-left font-bold">Marka</th>
                  <th className="w-[16%] text-left font-bold">Quality</th>
                  <th className="w-[11%] text-right font-bold">Grade/Qty</th>
                  <th className="w-[13%] text-right font-bold pr-2">Rate/m.T</th>
                </tr>
              </thead>
              <tbody>
                {/* Dashed Separator */}
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="border-t border-dashed border-neutral-950 w-full my-0.5"></div>
                  </td>
                </tr>
                {paddedItems.map((item, idx) => {
                  const isFirstRow = idx === 0;
                  return (
                    <tr key={idx} className="h-5 text-[11px] font-semibold leading-normal">
                      <td className="text-left font-extrabold py-0.5">{isFirstRow ? po.total_no_of_lorries || '1' : ''}</td>
                      <td className="text-left py-0.5">{isFirstRow ? (item.crop || '2025-26') : ''}</td>
                      <td className="text-left uppercase truncate py-0.5">{isFirstRow ? (item.agency_name || po.area) : ''}</td>
                      <td className="text-left uppercase truncate py-0.5">{isFirstRow ? (item.marka_name || 'NO MARK') : ''}</td>
                      <td className="text-left uppercase py-0.5 font-extrabold">{formatQualityName(item.grade_name)}</td>
                      <td className="text-right font-bold py-0.5">{item.qty ? item.qty : ''}</td>
                      <td className="text-right font-extrabold py-0.5 pr-2">{item.rate ? (Number(item.rate) * 10).toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Bottom Dashed Separator */}
            <div className="border-t border-dashed border-neutral-950 w-full mt-1 mb-1"></div>
          </div>

          {/* Unit Quantities and parameters summary */}
          <div className="text-[11.5px]">
            <div className="flex justify-between items-center w-full uppercase py-0.5 leading-none">
              <div className="w-[22%]">Unit : {po.purchase_unit_name || 'DRUMS'}</div>
              <div className="w-[28%]">{po.purchase_unit_name || 'DRUMS'} / Lorry : {po.units_per_lorry || '200'}</div>
              <div className="w-[28%]">Total {po.purchase_unit_name || 'DRUMS'} : {po.total_units || '200'}</div>
              <div className="w-[22%] text-right pr-2 whitespace-nowrap">Wt/Lry (M.Ton) : {Number(po.weight_per_lorry || '10.000').toFixed(3)}</div>
            </div>
            <div className="flex w-full uppercase py-1 leading-none mt-0.5">
              <div className="w-[22%]">Area : {po.area || 'DAISSE'}</div>
              <div className="flex-1">Total No. of Lorries  :{po.total_no_of_lorries || '1'} [ {numberToWords(Number(po.total_no_of_lorries) || 1)} ]</div>
            </div>

            <div className="border-t border-dashed border-neutral-950 w-full my-1.5"></div>

            {/* Delivery rules, penalties and signature block */}
            <div className="flex justify-between items-center w-full leading-none py-0.5">
              <div className="w-[50%] truncate">Delivery Schedule : {formatDateDotMatrix(po.delivery_from)} To {formatDateDotMatrix(po.delivery_to)}</div>
              <div className="w-[25%]">Grace Days   :{po.grace_days || '0'}</div>
              <div className="w-[25%] text-right pr-2">Delivery Penalty :{po.delivery_penalty || '5'}</div>
            </div>
            <div className="flex justify-between items-center w-full leading-none py-1 mt-0.5">
              <div className="w-[50%] truncate">P.O Marka Type    : {po.marka_type || 'Normal'}</div>
              <div className="w-[25%]">Marka Penalty :{po.marka_penalty || '0'}</div>
              <div className="w-[25%] text-right pr-2 font-bold">Quantity Penalty :{po.qty_penalty || '0'}</div>
            </div>

            <div className="border-t border-dashed border-neutral-950 w-full my-1.5"></div>

            {/* Final Row: Signature alignment next to terms and condition summary */}
            <div className="flex justify-between items-start min-h-[50px] pt-1">
              
              {/* Terms and conditions */}
              <div className="w-[60%] pr-4 text-[10px] leading-tight uppercase font-semibold">
                <div className="flex items-start">
                  <span className="shrink-0 font-bold">Terms & Condition :&nbsp;</span>
                  <span className="flex-1 whitespace-pre-line text-[10px] leading-relaxed">
                    {po.terms_condition || 'PENALTY RS.5/-PER DAY,AREA,AGENCY,\nGRADE, GRADE DIFFERENTIAL CAN\nCHANGE AS PER MARKET.'}
                  </span>
                </div>
                {po.remarks && (
                  <div className="mt-1 text-[8.5px] leading-none text-neutral-500 truncate lowercase italic">
                    remarks: {po.remarks}
                  </div>
                )}
              </div>

              {/* Authorised Signatory Block */}
              <div className="w-[38%] flex flex-col justify-between text-[11px] self-stretch">
                <div className="font-bold text-left text-[11px] leading-none">
                  For : BALLY JUTE COMPANY LIMITED
                </div>
                
                <div className="flex flex-col items-center justify-end mt-12">
                  <div className="w-full border-b border-neutral-950"></div>
                  <div className="text-[10px] font-bold text-center mt-1">( Authorised Signatory )</div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Hand Sprocket Margin Strip */}
        <div className="sprocket-strip w-[13mm] min-w-[13mm] flex flex-col justify-around items-center bg-white border-l border-dotted border-neutral-300 py-3  relative z-10">
          {sprocketHoles.map((_, idx) => (
            <div 
              key={`right-hole-${idx}`} 
              className="w-3 h-3 rounded-full border border-neutral-300 bg-neutral-50 flex items-center justify-center text-[5px]"
            >
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
