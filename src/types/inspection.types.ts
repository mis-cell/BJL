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

export interface InspectionProps {
  onNavigate?: (page: string) => void;
}
