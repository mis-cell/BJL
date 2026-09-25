import React from "react";
import { LegacyFieldset } from "../LegacyLayout";
import { SingleComboBox, SearchablePoContractDropdown, DualComboBox } from "./PoDropdownSelectors";
import { PoFormData } from "../../types/purchaseOrder";
import { Calculator } from "lucide-react";

export interface PurchaseOrderFormHeaderProps {
  formData: PoFormData;
  setFormData: React.Dispatch<React.SetStateAction<PoFormData>>;
  isSaudaActive: boolean;
  isTempPo: boolean;
  poList: any[];
  brokerList: any[];
  supplierList: any[];
  areaList: any[];
  unitList: string[];
  displaySaudas: any[];
  handleSaudaSelect: (val: string) => void;
  getCropYear: () => string;
  generateNextPtfNo: (list: any[]) => string;
  recalculateAllRates: (...args: any[]) => any[];
  sattaBaseRates: any;
  sattaCalculatedRates: any;
  sattaDifferentials: any;
  handlePurchaseUnitChange: (name: string, code: string) => void;
  setCalcData: React.Dispatch<React.SetStateAction<any>>;
  setIsCalcOpen: (open: boolean) => void;
  lookupSattaBaseRate: (date: string, bases?: any[]) => string | null;
}

export const PurchaseOrderFormHeader: React.FC<PurchaseOrderFormHeaderProps> = ({
  formData,
  setFormData,
  isSaudaActive,
  isTempPo,
  poList,
  brokerList,
  supplierList,
  areaList,
  unitList,
  displaySaudas,
  handleSaudaSelect,
  getCropYear,
  generateNextPtfNo,
  recalculateAllRates,
  sattaBaseRates,
  sattaCalculatedRates,
  sattaDifferentials,
  handlePurchaseUnitChange,
  setCalcData,
  setIsCalcOpen,
  lookupSattaBaseRate,
}) => {
  return (
            <LegacyFieldset legend="Purchase Order Information Header">
              <div className="grid grid-cols-12 gap-x-2 gap-y-1">
                {isSaudaActive && (
                  <div className="col-span-12 mb-1 p-1 bg-amber-50 border border-amber-300 text-[10px] text-amber-850 flex items-center gap-1.5 font-normal rounded-sm">
                    <span className="font-bold">⚡ Sauda Live Link Connected:</span> Sauda details automatically pull into form fields below.
                  </div>
                )}
                
                {/* ROW 1 */}
                {/* <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label className="whitespace-nowrap min-w-[70px]">Purchase Order</label>
                  <SingleComboBox value={formData.purchase_order} onChange={(val) => setFormData({...formData, purchase_order: val})} options={[{text: 'FINAL PO', value: 'FINAL PO'}]} textField="text" valueField="value" />
                </div> */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label className="whitespace-nowrap shrink-0 text-[10px] font-bold">
                    Purchase Order
                  </label>

                    <SingleComboBox
                      value={formData.purchase_order}
                      onChange={(val) =>
                        setFormData({...formData, purchase_order: val})
                      }
                      options={[{text: 'FINAL PO', value: 'FINAL PO'}]}
                      textField="text"
                      valueField="value"
                    />

                </div>
                {/* Type */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1 lg:pl-6">
                  <label className="ml-0 sm:ml-2 min-w-[30px]">Type</label>
                  <SingleComboBox
                    value={formData.po_type}
                    onChange={(val) => setFormData({...formData, po_type: val})}
                    options={[
                      {text: 'Normal', value: 'Normal'},
                      {text: 'Special', value: 'Special'}
                    ]}
                    textField="text"
                    valueField="value"
                  />
                </div>
               {/*  <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label className="ml-0 sm:ml-2 min-w-[30px]">Type</label>
                  <SingleComboBox value={formData.po_type} onChange={(val) => setFormData({...formData, po_type: val})} options={[{text: 'Normal', value: 'Normal'}, {text: 'Special', value: 'Special'}]} textField="text" valueField="value" />
                </div> */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1 lg:pl-7">
                  <label className="whitespace-nowrap flex items-center cursor-pointer gap-1 text-[11px] font-extrabold text-[#7c2d12]">
                    <input  id="checkbox_3401" name="checkbox" aria-label="checkbox"
                      type="checkbox" 
                      className="w-3.5 h-3.5 cursor-pointer accent-[#7c2d12]" 
                      checked={formData.is_ptf} 
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        const defaultItems = formData.items.length > 0 ? formData.items : [
                          {
                            srl: 1,
                            crop: getCropYear(),
                            grade_code: '',
                            grade_name: '',
                            agency_code: '',
                            agency_name: '',
                            marka_code: '',
                            marka_name: '',
                            qty: 200,
                            weight: 10,
                            rate: 0,
                            premium: 0
                          }
                        ];
                        setFormData({
                          ...formData, 
                          is_ptf: isChecked, 
                          no: isChecked ? '' : formData.no,
                          ptf_no: isChecked ? (formData.ptf_no || generateNextPtfNo(poList)) : '',
                          items: defaultItems
                        });
                      }} 
                    />
                    P.T.F Mode
                  </label>
                  <input  id="formdata_ptf_no_3433" name="formdata_ptf_no" aria-label="formdata ptf no"
                    type="text" 
                    className={`flex-1 bg-white border border-slate-400 p-0.5 outline-none font-bold text-black ${!formData.is_ptf ? 'bg-slate-100 text-slate-400' : ''}`}
                    value={formData.ptf_no} 
                    onChange={(e) => setFormData({...formData, ptf_no: e.target.value})} 
                    readOnly={!formData.is_ptf}
                  />
                </div>
                <div className=" lg:pl-12 col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1 justify-center sm:justify-start whitespace-nowrap">
                  <label htmlFor="pending_radio_3443" className="mr-1 min-w-[50px] text-center sm:text-left">Pending</label>
                  <input  id="pending_radio_3443" aria-label="Pending"type="radio" value="Yes" checked={formData.pending === 'Yes'} onChange={(e) => setFormData({...formData, pending: e.target.value})} name="pending_radio" className="mr-0.5 w-3 h-3 cursor-pointer" /> Yes
                  <input  id="pending_radio_3444" aria-label="Pending"type="radio" value="No" checked={formData.pending === 'No'} onChange={(e) => setFormData({...formData, pending: e.target.value})} name="pending_radio" className="ml-2 mr-0.5 w-3 h-3 cursor-pointer" /> No
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1 -ml-6">
                  <label htmlFor="p_o_contract_3449" className={`whitespace-nowrap min-w-[70px] ${formData.is_ptf ? 'text-slate-400' : ''}`}>P.O Contract</label>
                  {formData.is_ptf ? (
                    <input  id="p_o_contract_3449" name="p_o_contract" aria-label="P.O Contract"type="text" className="flex-1 bg-slate-100 border border-slate-400 p-0.5 outline-none text-slate-400" disabled value="" />
                  ) : (
                    <SearchablePoContractDropdown 
                      id="p_o_contract_3449" 
                      value={formData.no} 
                      onChange={handleSaudaSelect} 
                      options={displaySaudas} 
                      hasSaudaHighlight={isSaudaActive} 
                    />
                  )}
                </div>
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex items-center gap-1">
                  <label htmlFor="date_3456" className="ml-0 sm:ml-2 min-w-[30px]">P.O Date</label>
                  <input  id="date_3456" name="date" aria-label="Date"type="date" className="flex-1 bg-white border border-slate-400 p-0.5 outline-none text-black" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>

                {/* ROW 2 */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex items-center gap-2">
                  <label className="w-24 sm:w-32 md:w-40 text-right shrink-0">Broker</label>
                  <DualComboBox 
                    hasSaudaHighlight={isSaudaActive} 
                    showCode={false} 
                    isRequired={true}
                    label="Broker"
                    placeholder="-- SEARCH OR SELECT BROKER * --"
                    code={formData.broker_code} 
                    name={formData.broker} 
                    onCodeChange={(val) => setFormData(prev => ({...prev, broker_code: val}))} 
                    onNameChange={(val) => setFormData(prev => ({...prev, broker: val}))} 
                    options={brokerList} 
                    codeField="brok_code" 
                    nameField="brok_name" 
                  />
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex items-center gap-2">
                  <label className="w-24 sm:w-32 md:w-40 text-right shrink-0">Supplier</label>
                  <DualComboBox 
                    hasSaudaHighlight={isSaudaActive} 
                    showCode={false} 
                    isRequired={true}
                    label="Supplier"
                    placeholder="-- SEARCH OR SELECT SUPPLIER * --"
                    code={formData.supplier_code} 
                    name={formData.supplier} 
                    onCodeChange={(val) => setFormData(prev => ({...prev, supplier_code: val}))} 
                    onNameChange={(val) => setFormData(prev => ({...prev, supplier: val}))} 
                    options={supplierList} 
                    codeField="supp_code" 
                    nameField="supp_name" 
                  />
                </div>

                {/* ROW 3 */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 flex items-center gap-2">
                   <label className="w-24 sm:w-32 md:w-40 whitespace-nowrap text-right shrink-0">Challan Supplier</label>
                   <DualComboBox 
                     hasSaudaHighlight={isSaudaActive} 
                     showCode={false} 
                     isRequired={false}
                     label="Challan Supplier"
                     placeholder="-- SEARCH OR SELECT CHALLAN SUPPLIER --"
                     code={formData.challan_supplier_code} 
                     name={formData.challan_supplier} 
                     onCodeChange={(val) => setFormData(prev => ({...prev, challan_supplier_code: val}))} 
                     onNameChange={(val) => setFormData(prev => ({...prev, challan_supplier: val}))} 
                     options={supplierList} 
                     codeField="supp_code" 
                     nameField="supp_name" 
                   />
                </div>

                {/* ROW 4 */}
                <div className="col-span-12 lg:col-span-6 flex items-center gap-2">
                  <label className="w-24 sm:w-32 md:w-40 text-right shrink-0">Area</label>
                  <DualComboBox 
                    hasSaudaHighlight={isSaudaActive} 
                    showCode={true}
                    isRequired={true}
                    label="Area"
                    placeholder="-- SEARCH OR SELECT AREA * --"
                    code={formData.area_code} 
                    name={formData.area} 
                    onCodeChange={(val) => setFormData(prev => ({...prev, area_code: val}))} 
                    onNameChange={(val) => {
                      if (val && val.trim().toUpperCase() !== (formData.area || '').trim().toUpperCase()) {
                        const updatedItems = recalculateAllRates(formData.items, formData.s_date, formData.b_rate, sattaBaseRates, sattaCalculatedRates, sattaDifferentials, val);
                        setFormData(prev => ({
                          ...prev, 
                          area: val,
                          items: updatedItems
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          area: val
                        }));
                      }
                    }} 
                    options={areaList} 
                    codeField="area_code" 
                    nameField="area_name" 
                  />
                </div>
                <div className="col-span-12 lg:col-span-6 flex items-center gap-2">
                  <label htmlFor="transportation_charges_pa_3498" className="whitespace-nowrap w-24 sm:w-32 md:w-48 text-right shrink-0">Transportation Charges paid by</label>
                  <select  id="transportation_charges_pa_3498" name="transportation_charges_pa" aria-label="Transportation Charges paid by"className="w-24 bg-white border border-slate-400 p-0.5 outline-none text-black" value={formData.trans_paid_by} onChange={(e) => setFormData({...formData, trans_paid_by: e.target.value})}>
                     <option>PARTY</option>
                     <option>COMPANY</option>
                  </select>
                </div>

                {/* ROW 5 */}
                <div className="col-span-12 flex flex-wrap items-center gap-y-2 gap-x-4 mb-1 mt-1 font-normal">
                   <div className="flex items-center gap-2">
                      <label htmlFor="against_cancellation_3508" className="w-24 sm:w-32 md:w-40 text-right whitespace-nowrap font-bold shrink-0">Against Cancellation</label>
                      <select  id="against_cancellation_3508" name="against_cancellation" aria-label="Against Cancellation"className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-black font-semibold" value={formData.against_cancellation} onChange={(e) => setFormData({...formData, against_cancellation: e.target.value})}>
                         <option>No</option>
                         <option>Yes</option>
                      </select>
                   </div>
                   <div className="flex items-center gap-2">
                      <label htmlFor="purchase_unit_3515" className="whitespace-nowrap font-bold">Purchase Unit</label>
                      <input  id="purchase_unit_3515" name="purchase_unit" aria-label="Purchase Unit"className="w-12 bg-white border border-slate-400 p-0.5 outline-none text-center text-black font-bold font-mono" value={formData.purchase_unit_code || '1'} onChange={(e) => {
                         const val = e.target.value;
                         setFormData(prev => ({ ...prev, purchase_unit_code: val }));
                      }} />
                      <select  id="formdata_purchase_unit_na_3519" name="formdata_purchase_unit_na" aria-label="formdata purchase unit na"className="w-24 bg-white border border-slate-400 p-0.5 outline-none text-black font-semibold cursor-pointer" value={formData.purchase_unit_name} onChange={(e) => {
                         const name = e.target.value;
                         handlePurchaseUnitChange(name, formData.purchase_unit_code || '1');
                      }}>
                         {Array.from(new Set([...unitList, formData.purchase_unit_name].filter(Boolean))).map((u: string) => (
                            <option key={u} value={u}>{u}</option>
                         ))}
                      </select>
                   </div>
                   <div className="flex items-center gap-2">
                      <label htmlFor="weight_unit_kgs_3530" className="whitespace-nowrap font-bold">Weight/Unit (Kgs.)</label>
                      <input  id="weight_unit_kgs_3530" name="weight_unit_kgs" aria-label="Weight/Unit (Kgs.)"className="w-16 bg-slate-100 border border-slate-400 p-0.5 outline-none text-right font-bold text-black" value={formData.weight_unit_kgs} readOnly />
                      <button onClick={(e) => { 
                          e.preventDefault(); 
                          setCalcData({
                              total_lorries: formData.total_no_of_lorries || '1',
                              units_per_lorry: formData.units_per_lorry || '200',
                              total_units: formData.total_units || '200',
                              weight_per_lorry: formData.total_contract_mt || formData.weight_per_lorry || '29.500'
                           } as any);
                          setIsCalcOpen(true); 
                      }} className="bg-slate-200 border border-slate-400 px-3.5 py-0.5 hover:bg-slate-300 ml-2 shadow-sm font-bold text-black">Calculate Helper</button>
                   </div>
                </div>

                {/* ROW 6 */}
                <div className="col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-1 border border-slate-400 p-1 bg-gray-50/50">
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="total_no_of_lorries_3547" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Total No of Lorries</label>
                      <input  
                        id="total_no_of_lorries_3547" 
                        name="total_no_of_lorries" 
                        aria-label="Total No of Lorries"
                        className="w-12 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.total_no_of_lorries} 
                        onChange={(e) => {
                          const lorriesVal = e.target.value;
                          const lorries = parseFloat(lorriesVal) || 0;
                          const totUnits = parseFloat(formData.total_units) || 0;
                          const isDrums = (formData.purchase_unit_name || '').toUpperCase() === 'DRUMS';
                          const unitWt = isDrums ? 50 : 147.5;

                          if (lorries > 0 && totUnits > 0) {
                            const unitsPerLorry = totUnits / lorries;
                            const unitsPerLorryStr = Number.isInteger(unitsPerLorry) ? unitsPerLorry.toString() : unitsPerLorry.toFixed(2);
                            const totContractMt = ((totUnits * unitWt) / 1000).toFixed(3);
                            const wtPerLorry = (parseFloat(totContractMt) / lorries).toFixed(3);
                            setFormData(prev => ({
                              ...prev,
                              total_no_of_lorries: lorriesVal,
                              units_per_lorry: unitsPerLorryStr,
                              weight_per_lorry: wtPerLorry,
                              total_contract_mt: totContractMt
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              total_no_of_lorries: lorriesVal
                            }));
                          }
                        }} 
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="units_lorry_3551" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Units / Lorry</label>
                      <input  
                        id="units_lorry_3551" 
                        name="units_lorry" 
                        aria-label="Units / Lorry"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.units_per_lorry} 
                        onChange={(e) => {
                          const unitsVal = e.target.value;
                          const unitsPerLorry = parseFloat(unitsVal) || 0;
                          const lorries = parseFloat(formData.total_no_of_lorries) || 0;
                          const isDrums = (formData.purchase_unit_name || '').toUpperCase() === 'DRUMS';
                          const unitWt = isDrums ? 50 : 147.5;

                          if (lorries > 0 && unitsPerLorry > 0) {
                            const totUnits = Math.round(lorries * unitsPerLorry);
                            const wtPerLorry = ((unitsPerLorry * unitWt) / 1000).toFixed(3);
                            const totContract = ((totUnits * unitWt) / 1000).toFixed(3);
                            setFormData(prev => ({
                              ...prev,
                              units_per_lorry: unitsVal,
                              total_units: totUnits.toString(),
                              weight_per_lorry: wtPerLorry,
                              total_contract_mt: totContract
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              units_per_lorry: unitsVal
                            }));
                          }
                        }} 
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="total_units_3555" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Total Units</label>
                      <input  
                        id="total_units_3555" 
                        name="total_units" 
                        aria-label="Total Units"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.total_units} 
                        onChange={(e) => {
                          const totUnitsVal = e.target.value;
                          const totUnits = parseFloat(totUnitsVal) || 0;
                          const lorries = parseFloat(formData.total_no_of_lorries) || 0;
                          const isDrums = (formData.purchase_unit_name || '').toUpperCase() === 'DRUMS';
                          const unitWt = isDrums ? 50 : 147.5;

                          if (totUnits > 0) {
                            const unitsPerLorry = lorries > 0 ? (totUnits / lorries) : totUnits;
                            const unitsPerLorryStr = Number.isInteger(unitsPerLorry) ? unitsPerLorry.toString() : unitsPerLorry.toFixed(2);
                            const totContract = ((totUnits * unitWt) / 1000).toFixed(3);
                            const wtPerLorry = lorries > 0 ? (parseFloat(totContract) / lorries).toFixed(3) : totContract;
                            setFormData(prev => ({
                              ...prev,
                              total_units: totUnitsVal,
                              units_per_lorry: unitsPerLorryStr,
                              weight_per_lorry: wtPerLorry,
                              total_contract_mt: totContract
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              total_units: totUnitsVal
                            }));
                          }
                        }} 
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between">
                      <label htmlFor="weight_lorry_m_ton_3559" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Weight/Lorry (M.Ton)</label>
                      <input  
                        id="weight_lorry_m_ton_3559" 
                        name="weight_lorry_m_ton" 
                        aria-label="Weight/Lorry (M.Ton)"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-[#7c2d12]" 
                        value={formData.weight_per_lorry} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const wtVal = parseFloat(val) || 0;
                          const isDrums = (formData.purchase_unit_name || '').toUpperCase() === 'DRUMS';
                          const unitWt = isDrums ? 50 : 147.5;
                          const lorries = parseFloat(formData.total_no_of_lorries) || 1;

                          if (wtVal > 0) {
                            const totUnits = Math.round((wtVal * 1000) / unitWt);
                            const unitsPerLorry = lorries > 0 ? (totUnits / lorries) : totUnits;
                            const unitsPerLorryStr = Number.isInteger(unitsPerLorry) ? unitsPerLorry.toString() : unitsPerLorry.toFixed(2);
                            const totContract = wtVal.toFixed(3);
                            setFormData(prev => ({
                              ...prev,
                              weight_per_lorry: val,
                              total_units: totUnits.toString(),
                              units_per_lorry: unitsPerLorryStr,
                              total_contract_mt: totContract
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              weight_per_lorry: val
                            }));
                          }
                        }} 
                        onBlur={() => {
                          if (formData.weight_per_lorry && !isNaN(Number(formData.weight_per_lorry))) {
                            setFormData(prev => ({
                              ...prev,
                              weight_per_lorry: Number(prev.weight_per_lorry).toFixed(3)
                            }));
                          }
                        }}
                      />
                   </div>
                   <div className="flex items-center gap-1 justify-between col-span-2 sm:col-span-1">
                      <label htmlFor="total_contract_m_ton_3563" className="whitespace-nowrap pr-1 text-right w-full text-indigo-900 font-bold text-[10px]">Total Contract (M.Ton)</label>
                      <input  
                        id="total_contract_m_ton_3563" 
                        name="total_contract_m_ton" 
                        aria-label="Total Contract (M.Ton)"
                        className="w-16 bg-white border border-slate-400 p-0.5 outline-none text-right font-extrabold text-blue-900" 
                        value={formData.total_contract_mt} 
                        onChange={(e) => setFormData({...formData, total_contract_mt: e.target.value})} 
                        onBlur={() => {
                          if (formData.total_contract_mt && !isNaN(Number(formData.total_contract_mt))) {
                            setFormData(prev => ({
                              ...prev,
                              total_contract_mt: Number(prev.total_contract_mt).toFixed(3)
                            }));
                          }
                        }}
                      />
                   </div>
                </div>

                {/* ROW 7 */}
                <div className="col-span-12 grid grid-cols-12 gap-2 mb-2 mt-1">
                   <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                      <label htmlFor="marka_type_3571" className="w-24 text-right shrink-0">Marka Type</label>
                      <select  id="marka_type_3571" name="marka_type" aria-label="Marka Type"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none font-bold text-black">
                         <option>{formData.marka_type}</option>
                      </select>
                   </div>
                   <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                      <label htmlFor="marka_penalty_3577" className="w-24 sm:w-32 text-right shrink-0">Marka Penalty</label>
                      <input  id="marka_penalty_3577" name="marka_penalty" aria-label="Marka Penalty"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none text-right font-normal text-black" value={formData.marka_penalty} onChange={(e) => setFormData({...formData, marka_penalty: e.target.value})} />
                   </div>
                   <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                      <label htmlFor="quantity_penalty_3581" className="w-24 sm:w-32 text-right shrink-0">Quantity Penalty</label>
                      <input  id="quantity_penalty_3581" name="quantity_penalty" aria-label="Quantity Penalty"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none text-right font-normal text-black" value={formData.qty_penalty} onChange={(e) => setFormData({...formData, qty_penalty: e.target.value})} />
                   </div>
                </div>
                
                {/* Divider */}
                <div className="col-span-12 border-b border-slate-400 mb-2"></div>
                
                {/* Detailed sections below */}
                <div className="col-span-12 grid grid-cols-12 gap-x-2 gap-y-1.5">
                  <div className="col-span-12 flex flex-wrap items-center gap-2 mt-1">
                    <label htmlFor="delivery_gt_from_3592" className="w-24 font-bold italic shrink-0">Delivery --&gt;From</label>
                    <input  id="delivery_gt_from_3592" name="delivery_gt_from" aria-label="Delivery --&gt;From"type="date" className={`w-28 p-0.5 outline-none font-normal border transition-colors duration-150 text-black ${
                      isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold" : "bg-white border-slate-400"
                    }`} value={formData.delivery_from} onChange={(e) => setFormData({...formData, delivery_from: e.target.value})} />
                    <label htmlFor="to_3596" className="mx-2 shrink-0">To</label>
                    <input  id="to_3596" name="to" aria-label="To"type="date" className={`w-28 p-0.5 outline-none font-normal border transition-colors duration-150 text-black ${
                      isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold" : "bg-white border-slate-400"
                    }`} value={formData.delivery_to} onChange={(e) => setFormData({...formData, delivery_to: e.target.value})} />
                    <label htmlFor="grace_days_3600" className="ml-2 shrink-0">Grace Days</label>
                    <input  id="grace_days_3600" name="grace_days" aria-label="Grace Days"className={`w-12 p-0.5 outline-none text-right font-normal border text-black transition-colors duration-150 ${
                      isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold font-mono" : "bg-white border-slate-400"
                    }`} value={formData.grace_days} onChange={(e) => setFormData({...formData, grace_days: e.target.value})} />
                    <label htmlFor="delivery_penalty_3604" className="ml-2 shrink-0">Delivery Penalty</label>
                    <input  id="delivery_penalty_3604" name="delivery_penalty" aria-label="Delivery Penalty"className={`w-12 p-0.5 outline-none text-right font-normal border text-black transition-colors duration-150 ${
                      isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold font-mono" : "bg-white border-slate-400"
                    }`} value={formData.delivery_penalty} onChange={(e) => setFormData({...formData, delivery_penalty: e.target.value})} />
                  </div>

                  <div className="col-span-12 lg:col-span-6 flex items-center gap-2">
                    <label className="w-24 sm:w-32 text-right shrink-0">Contract / P.O No</label>
                    <div className="flex-1">
                      <SearchablePoContractDropdown 
                        value={formData.contract_po_no} 
                        onChange={handleSaudaSelect} 
                        options={displaySaudas} 
                        hasSaudaHighlight={isSaudaActive} 
                      />
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-6 flex flex-wrap sm:flex-nowrap items-center gap-2">
                     <label htmlFor="date_3617" className="w-24 text-right shrink-0">Date</label>
                     <input  id="date_3617" name="date" aria-label="Date"type="date" className={`w-28 p-0.5 outline-none font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.contract_date} onChange={(e) => setFormData({...formData, contract_date: e.target.value})} />
                     <label htmlFor="rate_detail_3621" className="w-24 text-right shrink-0">Rate Detail</label>
                     <input  id="rate_detail_3621" name="rate_detail" aria-label="Rate Detail"className="flex-1 min-w-[120px] bg-white border border-slate-400 p-0.5 outline-none font-normal text-black" value={formData.rate_detail} onChange={(e) => setFormData({...formData, rate_detail: e.target.value})} />
                   </div>

                  <div className="col-span-12 flex items-center gap-2">
                     <label htmlFor="delivery_schedule_3626" className="w-24 sm:w-32 text-right shrink-0">Delivery Schedule</label>
                     <input  id="delivery_schedule_3626" name="delivery_schedule" aria-label="Delivery Schedule"className="flex-1 bg-white border border-slate-400 p-0.5 outline-none font-normal text-black" value={formData.delivery_schedule} onChange={(e) => setFormData({...formData, delivery_schedule: e.target.value})} />
                  </div>

                  <div className="col-span-12 flex items-start gap-2">
                     <label htmlFor="terms_condition_3631" className="w-24 sm:w-32 text-right leading-none mt-1 shrink-0">Terms & Condition</label>
                     <textarea  id="terms_condition_3631" name="terms_condition" aria-label="Terms & Condition"className={`flex-1 p-0.5 outline-none h-12 text-[10px] font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.terms_condition} onChange={(e) => setFormData({...formData, terms_condition: e.target.value})} />
                  </div>

                  <div className="col-span-12 flex items-center gap-2 mt-1">
                     <label htmlFor="remarks_3638" className="w-24 sm:w-32 text-right shrink-0">Remarks</label>
                     <input  id="remarks_3638" name="remarks" aria-label="Remarks"className={`flex-1 p-0.5 outline-none font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} />
                  </div>

                  <div className="col-span-12 flex flex-wrap items-center gap-2 pb-1">
                     <label htmlFor="po_identification_3645" className="w-24 sm:w-32 text-right shrink-0">PO Identification</label>
                     <select  id="po_identification_3645" name="po_identification" aria-label="PO Identification"className="w-48 bg-white border border-slate-400 p-0.5 outline-none font-normal text-black">
                        <option>{formData.po_identification}</option>
                     </select>
                     <label className="ml-0 sm:ml-4 shrink-0">Souda Date</label>
                     <input  id="po_identification_3649" name="po_identification" aria-label="PO Identification"type="date" className={`w-28 p-0.5 outline-none font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold" : "bg-white border-slate-400"
                     }`} value={formData.s_date} onChange={(e) => {
                        const val = e.target.value;
                        const autoBRate = lookupSattaBaseRate(val, sattaBaseRates);
                        const newBRate = autoBRate || formData.b_rate;
                        const updatedItems = recalculateAllRates(formData.items, val, newBRate);
                        setFormData({
                           ...formData, 
                           s_date: val,
                           b_rate: newBRate,
                           items: updatedItems
                        });
                     }} />
                     <label className="ml-0 sm:ml-4 flex items-center gap-1 group relative cursor-help shrink-0">
                        <span>B Rate</span>
                        <span className="text-[7.5px] font-black bg-indigo-950 text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif">i</span>
                        <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md font-sans leading-normal font-normal normal-case text-left">
                           DB Reference: <code className="text-yellow-400 font-mono">purchase_master.b_rate</code>
                           <p className="mt-1">Format: Numeric decimal representing Brokerage rate per ton/unit.</p>
                        </div>
                     </label>
                     <input  id="formdata_b_rate_3668" name="formdata_b_rate" aria-label="formdata b rate"className={`flex-1 min-w-[60px] p-0.5 outline-none text-right font-normal border text-black transition-colors duration-150 ${
                       isSaudaActive ? "bg-[#EAF4FF] border-sky-300 text-sky-950 font-semibold font-mono" : "bg-white border-slate-400"
                     }`} value={formData.b_rate} onChange={(e) => {
                        const val = e.target.value;
                        const updatedItems = recalculateAllRates(formData.items, formData.s_date, val);
                        setFormData({
                           ...formData, 
                           b_rate: val,
                           items: updatedItems
                        });
                     }} />
                  </div>
                </div>
              </div>
            </LegacyFieldset>

  );
};
