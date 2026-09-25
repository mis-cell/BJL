export interface DeductionRow {
  id: string;
  deduction_type: string;
  deduction_rate: number;
  deduction_qty: number;
  deduction_amount: number;
  remarks?: string;
}

export interface MatchedAutoDeduction {
  category: "bale_weight" | "ropes_chatta" | "delivery_claim" | "damage" | "other";
  ruleName: string;
  matchedRule: any;
  rate: number;
  qty: number;
  amount: number;
  reason: string;
  badge: string;
}

export interface MoistureLogicRule {
  id?: string | number;
  season?: string;
  operating_area?: string;
  threshold_limit?: string | number;
  claim_formula?: string;
  remarks?: string;
}

export interface InspectionMasterRecord {
  mr_no: string;
  mr_date?: string;
  arrival_no?: string;
  arrival_date?: string;
  po_no?: string;
  po_date?: string;
  broker_name?: string;
  supplier_name?: string;
  broker?: string;
  supplier?: string;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  actual_grade_down?: number;
  claim_grade_down?: number;
  settlement_moisture?: number;
  settlement_grade_down?: number;
  settlement_dust?: number;
  settlement_ncv?: number;
  detention_days?: number;
  unloading_date?: string;
  mill_po_no?: string;
  mill_po_date?: string;
  mr_spcl_print?: string;
  remarks?: string;
  lorry_number?: string;
  delivery_claim?: number;
  unit_name?: string;
  unit_code?: string;
  deduction_type?: string;
  deduction_rate?: number;
  deduction_qty?: number;
  deduction_amount?: number;
  deductions?: DeductionRow[];
  deduction_rows?: DeductionRow[];
  status?: string;
  created_at?: string;
  grid_details?: any;
  details?: any;
  quality_matrix?: any;
  company_id?: string;
  unit_id?: string;
  machine_id?: string;
  shift?: string;
  department?: string;
  production_id?: string;
  production_ref?: string;
  batch_id?: string;
  quantity?: number;
  total_quantity?: number;
  challan_gross_wt?: number;
  receipt_gross_wt?: number;
  gross_weight_batch?: number;
  add_weight?: number;
  less_weight?: number;
  reduced_weight?: number;
  final_receipt_wt?: number;
  arrival_grade?: string;
  stock_grade_code?: string;
  stock_grade_name?: string;
  area?: string;
  agency?: string;
  agency_code?: string;
  marks?: string;
  marka?: string;
  crop_year?: string;
  lot?: string;
}

export interface InspectionDetailRow {
  id?: number;
  mr_no?: string;
  srl_no?: number;
  arrival_grade?: string;
  stock_grade_code?: string;
  stock_grade_name?: string;
  area?: string;
  agency?: string;
  agency_code?: string;
  marks?: string;
  marka?: string;
  crop_year?: string;
  lot?: string;
  quantity?: number;
  unit?: string;
  rate?: number | string;
  rate_qntl?: number | string;
  challan_gross_wt?: number;
  receipt_gross_wt?: number;
  gross_weight_batch?: number;
  add_weight?: number;
  less_weight?: number;
  reduced_weight?: number;
  lorry_moisture_min?: number;
  lorry_moisture_max?: number;
  lorry_read_min?: number;
  lorry_read_max?: number;
  lorry_read_avg?: number;
  insp_read_min?: number;
  insp_read_max?: number;
  insp_read_avg?: number;
  moisture_act?: number;
  moisture_claim?: number;
  dust_act?: number;
  dust_claim?: number;
  ncv_act?: number;
  ncv_claim?: number;
  grade_down_act?: number;
  grade_down_claim?: number;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  actual_grade_down?: number;
  claim_grade_down?: number;
  final_receipt_wt?: number;
  settlement_moisture?: number;
  settlement_grade_down?: number;
  settlement_dust?: number;
  settlement_ncv?: number;
  ropes_weight?: number;
  ropes_tot_wt_grd?: number;
  ropes_grade?: string;
  chotta_weight?: number;
  chotta_tot_wt_grd?: number;
  chotta_grade?: string;
  tolerable?: string;
  premium?: string;
  is_premium?: boolean;
  amount?: number;
  row_remarks?: string;
  jqi_remarks?: string;
  jci_remarks?: string;
  expanded?: boolean;
  is_auto?: boolean;
  auto_fields?: string[];
  temporary_arrival_no?: string;
}

export interface DetailFieldConfig {
  name: keyof InspectionDetailRow;
  label: string;
  type: "text" | "number" | "select";
}

export const detailFieldsConfig: DetailFieldConfig[] = [
  { name: "arrival_grade", label: "Arrival Grade", type: "text" },
  { name: "stock_grade_code", label: "Stock Grade Code", type: "text" },
  { name: "stock_grade_name", label: "Stock Grade Name", type: "text" },
  { name: "area", label: "Area", type: "text" },
  { name: "agency", label: "Agency", type: "text" },
  { name: "marks", label: "Marks / Marka", type: "text" },
  { name: "crop_year", label: "Crop Year", type: "text" },
  { name: "lot", label: "Lot", type: "text" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit", label: "Unit", type: "text" },
  { name: "challan_gross_wt", label: "Challan Gross Wt. MT.", type: "number" },
  { name: "receipt_gross_wt", label: "Receipt Gross Wt. MT.", type: "number" },
  { name: "gross_weight_batch", label: "Gross Weight (Batch)", type: "number" },
  { name: "add_weight", label: "Add Weight M.Ton", type: "number" },
  { name: "less_weight", label: "Less Weight M.Ton", type: "number" },
  { name: "reduced_weight", label: "Reduced Weight M.Ton", type: "number" },
  { name: "lorry_moisture_min", label: "Lorry Moisture Min", type: "number" },
  { name: "lorry_moisture_max", label: "Lorry Moisture Max", type: "number" },
  { name: "lorry_read_min", label: "Lorry Moisture Read Min", type: "number" },
  { name: "lorry_read_max", label: "Lorry Moisture Read Max", type: "number" },
  { name: "lorry_read_avg", label: "Lorry Moisture Read Avg", type: "number" },
  { name: "insp_read_min", label: "Insp. Moisture Read Min", type: "number" },
  { name: "insp_read_max", label: "Insp. Moisture Read Max", type: "number" },
  { name: "insp_read_avg", label: "Insp. Moisture Read Avg", type: "number" },
  { name: "moisture_act", label: "Moisture % Actual", type: "number" },
  { name: "moisture_claim", label: "Moisture % Claim", type: "number" },
  { name: "dust_act", label: "Dust % Actual", type: "number" },
  { name: "dust_claim", label: "Dust % Claim", type: "number" },
  { name: "ncv_act", label: "NCV % Actual", type: "number" },
  { name: "ncv_claim", label: "NCV % Claim", type: "number" },
  { name: "grade_down_act", label: "Grade Down % Actual", type: "number" },
  { name: "grade_down_claim", label: "Grade Down % Claim", type: "number" },
  { name: "final_receipt_wt", label: "Final Receipt Wt. (Claim)", type: "number" },
  { name: "settlement_moisture", label: "Mill Settlement % Moisture", type: "number" },
  { name: "settlement_grade_down", label: "Mill Settlement % Gr. Down", type: "number" },
  { name: "settlement_dust", label: "Mill Settlement % Dust", type: "number" },
  { name: "settlement_ncv", label: "Mill Settlement % NCV", type: "number" },
  { name: "ropes_weight", label: "Ropes Weight (Kg)", type: "number" },
  { name: "ropes_tot_wt_grd", label: "Ropes Tot. Wt. Grd%", type: "number" },
  { name: "ropes_grade", label: "Ropes Grade", type: "text" },
  { name: "chotta_weight", label: "Chotta & Habi Jabi Weight (Kg)", type: "number" },
  { name: "chotta_tot_wt_grd", label: "Chotta & Habi Jabi Tot. Wt. Grd%", type: "number" },
  { name: "chotta_grade", label: "Chotta & Habi Jabi Grade", type: "text" },
  { name: "tolerable", label: "Tolerable", type: "select" },
  { name: "premium", label: "Premium (MT Mode)", type: "select" },
  { name: "amount", label: "Amount (₹)", type: "number" },
  { name: "row_remarks", label: "Remarks", type: "text" },
  { name: "jqi_remarks", label: "JCI Remarks", type: "text" }
];

export interface InspectionProps {
  onNavigate?: (page: string) => void;
}
