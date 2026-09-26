import { supabase } from "./supabase";

export async function runDatabaseMigrations() {
  if (!supabase) return;
  try {
    if (typeof window !== 'undefined') {
      const isPatched = localStorage.getItem('bjl_app_db_patched_v5') || sessionStorage.getItem('bjl_app_db_patched_v5');
      if (isPatched) return;
      localStorage.setItem('bjl_app_db_patched_v5', '1');
      sessionStorage.setItem('bjl_app_db_patched_v5', '1');
    }
    await supabase.rpc("exec_sql", { 
      query: `
        DO $$ 
        BEGIN 
          ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS temporary_arrival_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS temporary_arrival_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS final_arrival_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS final_arrival_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS po_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS jci TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS jci_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_supplier TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS pan_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS part_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS part_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS transporter_name TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS di_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS di_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_railway_receipt_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_rr_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_rr_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS invoice_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS invoice_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_area_code TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_area_name TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS ptf TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS rfs TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS way_bill_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS way_bill_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS rr_gr_no TEXT;

          -- Migrate data safely
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='consignment_notice_no') THEN
            UPDATE final_arrival SET consignment_note = consignment_notice_no WHERE consignment_note IS NULL AND consignment_notice_no IS NOT NULL;
          END IF;
          UPDATE final_arrival SET consignment_note = consignment_note_no WHERE consignment_note IS NULL AND consignment_note_no IS NOT NULL;
          UPDATE final_arrival SET consignment_note_no = consignment_note WHERE consignment_note_no IS NULL AND consignment_note IS NOT NULL;
          UPDATE final_arrival SET challan_railway_receipt_no = challan_rr_no WHERE challan_railway_receipt_no IS NULL AND challan_rr_no IS NOT NULL;
          UPDATE final_arrival SET challan_rr_no = challan_railway_receipt_no WHERE challan_rr_no IS NULL AND challan_railway_receipt_no IS NOT NULL;

          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS consignment_note TEXT;
          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS consignment_note_no TEXT;
          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS challan_railway_receipt_no TEXT;
          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS challan_rr_no TEXT;
          UPDATE temporary_material_received SET consignment_note = consignment_note_no WHERE consignment_note IS NULL AND consignment_note_no IS NOT NULL;
          UPDATE temporary_material_received SET challan_railway_receipt_no = challan_rr_no WHERE challan_railway_receipt_no IS NULL AND challan_rr_no IS NOT NULL;
          
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='lorry_no') THEN 
            ALTER TABLE final_arrival RENAME COLUMN lorry_no TO lorry_number; 
          END IF; 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='vehicle_no') THEN 
            ALTER TABLE final_arrival RENAME COLUMN vehicle_no TO lorry_number; 
          END IF; 

          -- Sanitize LOOSE items in final_arrival table
          UPDATE final_arrival SET total_packets = 0 WHERE unit_name ILIKE '%LOOSE%' OR unit_name = 'LOOSE';

          DO $loose_clean$
          DECLARE
            r RECORD;
            g_arr jsonb;
            item jsonb;
            new_arr jsonb;
            u_str text;
            is_l boolean;
          BEGIN
            FOR r IN SELECT ctid, grid_details, unit_name FROM final_arrival WHERE grid_details IS NOT NULL AND grid_details != '' LOOP
              BEGIN
                g_arr := r.grid_details::jsonb;
                IF jsonb_typeof(g_arr) = 'array' THEN
                  new_arr := '[]'::jsonb;
                  FOR item IN SELECT * FROM jsonb_array_elements(g_arr) LOOP
                    u_str := UPPER(COALESCE(item->>'unit', r.unit_name, ''));
                    is_l := (u_str LIKE '%LOOSE%');
                    IF is_l THEN
                      item := jsonb_set(item, '{quantity_chln}', '0'::jsonb);
                      item := jsonb_set(item, '{quantity_rcpt}', '0'::jsonb);
                    END IF;
                    new_arr := new_arr || jsonb_build_array(item);
                  END FOR;
                  UPDATE final_arrival SET grid_details = new_arr::text WHERE ctid = r.ctid;
                END IF;
              EXCEPTION WHEN OTHERS THEN
                -- Ignore non-json or malformed strings
              END;
            END LOOP;
          END $loose_clean$; 

          -- Synchronize UNIT (e.g. DRUMS) from final_arrival / purchase_master to all inspection tables in Supabase
          DO $sync_inspection_units$
          DECLARE
            r RECORD;
            g_arr jsonb;
            item jsonb;
            u_str text;
          BEGIN
            -- 1. Sync from final_arrival unit_name column directly
            UPDATE material_inspection_details d
            SET unit = f.unit_name
            FROM final_arrival f
            WHERE (d.mr_no = f.mr_no OR d.mr_no = f.final_arrival_no OR d.mr_no = f.temporary_arrival_no OR d.mr_no = f.arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE mill_inspection_detail d
            SET unit = f.unit_name
            FROM final_arrival f
            WHERE (d.mr_no = f.mr_no OR d.mr_no = f.final_arrival_no OR d.mr_no = f.temporary_arrival_no OR d.mr_no = f.arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE inspection_details d
            SET unit = f.unit_name
            FROM final_arrival f
            WHERE (d.mr_no = f.mr_no OR d.mr_no = f.final_arrival_no OR d.mr_no = f.temporary_arrival_no OR d.mr_no = f.arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE material_inspection m
            SET unit_name = f.unit_name
            FROM final_arrival f
            WHERE (m.mr_no = f.mr_no OR m.mr_no = f.final_arrival_no OR m.arrival_no = f.temporary_arrival_no OR m.arrival_no = f.final_arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE mill_inspection_master m
            SET unit_name = f.unit_name
            FROM final_arrival f
            WHERE (m.mr_no = f.mr_no OR m.mr_no = f.final_arrival_no OR m.arrival_no = f.temporary_arrival_no OR m.arrival_no = f.final_arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            -- 2. Inspect grid_details JSON in final_arrival to extract item units (e.g. DRUMS)
            FOR r IN SELECT mr_no, final_arrival_no, temporary_arrival_no, arrival_no, po_no, grid_details, unit_name FROM final_arrival WHERE grid_details IS NOT NULL AND grid_details != '' LOOP
              BEGIN
                g_arr := r.grid_details::jsonb;
                IF jsonb_typeof(g_arr) = 'array' THEN
                  FOR item IN SELECT * FROM jsonb_array_elements(g_arr) LOOP
                    u_str := UPPER(COALESCE(item->>'unit', item->>'unit_name', r.unit_name, ''));
                    IF u_str != '' AND u_str != 'BALES' THEN
                      UPDATE material_inspection_details SET unit = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR mr_no = r.temporary_arrival_no OR mr_no = r.arrival_no;
                      UPDATE mill_inspection_detail SET unit = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR mr_no = r.temporary_arrival_no OR mr_no = r.arrival_no;
                      UPDATE inspection_details SET unit = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR mr_no = r.temporary_arrival_no OR mr_no = r.arrival_no;
                      UPDATE material_inspection SET unit_name = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR arrival_no = r.temporary_arrival_no OR arrival_no = r.final_arrival_no;
                      UPDATE mill_inspection_master SET unit_name = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR arrival_no = r.temporary_arrival_no OR arrival_no = r.final_arrival_no;
                      UPDATE final_arrival SET unit_name = u_str WHERE (mr_no = r.mr_no OR final_arrival_no = r.final_arrival_no) AND (unit_name IS NULL OR unit_name = '' OR unit_name = 'BALES');
                    END IF;
                  END LOOP;
                END IF;
              EXCEPTION WHEN OTHERS THEN
              END;
            END LOOP;

            -- 3. Sync from purchase_master if still BALES
            UPDATE material_inspection_details d
            SET unit = pm.unit_name
            FROM material_inspection m
            JOIN purchase_master pm ON (m.po_no = pm.po_no OR m.po_no = pm.contract_po_no)
            WHERE d.mr_no = m.mr_no
              AND pm.unit_name IS NOT NULL AND pm.unit_name != '' AND UPPER(pm.unit_name) != 'BALES';

            UPDATE mill_inspection_detail d
            SET unit = pm.unit_name
            FROM mill_inspection_master m
            JOIN purchase_master pm ON (m.po_no = pm.po_no OR m.po_no = pm.contract_po_no)
            WHERE d.mr_no = m.mr_no
              AND pm.unit_name IS NOT NULL AND pm.unit_name != '' AND UPPER(pm.unit_name) != 'BALES';

            -- 4. Specifically ensure DRUMS for PO BJCL/2026-2027/0009 or FA-505
            UPDATE material_inspection_details SET unit = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR mr_no ILIKE '%0009%';
            UPDATE mill_inspection_detail SET unit = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR mr_no ILIKE '%0009%';
            UPDATE material_inspection SET unit_name = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR po_no ILIKE '%0009%' OR arrival_no ILIKE '%FA-505%';
            UPDATE mill_inspection_master SET unit_name = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR po_no ILIKE '%0009%' OR arrival_no ILIKE '%FA-505%';
            UPDATE final_arrival SET unit_name = 'DRUMS' WHERE final_arrival_no ILIKE '%FA-505%' OR arrival_no ILIKE '%FA-505%' OR po_no ILIKE '%0009%';
          END $sync_inspection_units$; 

          -- Ensure payment_master and payment_details tables exist
          CREATE TABLE IF NOT EXISTS payment_master (
            payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            voucher_no TEXT UNIQUE NOT NULL,
            payment_date DATE,
            mr_no TEXT,
            po_no TEXT,
            po_date DATE,
            sett_date DATE,
            po_type TEXT,
            broker TEXT,
            supplier TEXT,
            party_id TEXT,
            party_name TEXT,
            chn_supplier TEXT,
            lorry_number TEXT,
            arrival_no TEXT,
            arrival_date DATE,
            arival_apmc_fees NUMERIC DEFAULT 0,
            payable_amt NUMERIC DEFAULT 0,
            payable_bill_no TEXT,
            payable_bill_date DATE,
            total_amount NUMERIC DEFAULT 0,
            paid_amount NUMERIC DEFAULT 0,
            payment_mode TEXT,
            bank_name TEXT,
            reference_no TEXT,
            remarks TEXT,
            status TEXT DEFAULT 'completed',
            payment_status TEXT DEFAULT 'Paid',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS payment_master DISABLE ROW LEVEL SECURITY;

          CREATE TABLE IF NOT EXISTS payment_details (
            detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id UUID,
            voucher_no TEXT,
            mr_no TEXT,
            col_index INT,
            grade TEXT,
            area TEXT,
            agency TEXT,
            marka_crop TEXT,
            quantity NUMERIC DEFAULT 0,
            arr_qty_wt NUMERIC DEFAULT 0,
            min_qty_wt NUMERIC DEFAULT 0,
            wt_phota NUMERIC DEFAULT 0,
            wt_quantity NUMERIC DEFAULT 0,
            rate_value NUMERIC DEFAULT 0,
            gd_claim NUMERIC DEFAULT 0,
            gd_sett NUMERIC DEFAULT 0,
            gd_rev NUMERIC DEFAULT 0,
            gd_final NUMERIC DEFAULT 0,
            moist_claim NUMERIC DEFAULT 0,
            moist_sett NUMERIC DEFAULT 0,
            moist_rev NUMERIC DEFAULT 0,
            moist_final NUMERIC DEFAULT 0,
            dust_claim NUMERIC DEFAULT 0,
            dust_sett NUMERIC DEFAULT 0,
            dust_rev NUMERIC DEFAULT 0,
            dust_final NUMERIC DEFAULT 0,
            ncv_claim NUMERIC DEFAULT 0,
            ncv_sett NUMERIC DEFAULT 0,
            ncv_rev NUMERIC DEFAULT 0,
            ncv_final NUMERIC DEFAULT 0,
            po_grade_claim NUMERIC DEFAULT 0,
            po_grade_sett NUMERIC DEFAULT 0,
            po_grade_rev NUMERIC DEFAULT 0,
            po_grade_final NUMERIC DEFAULT 0,
            adjust_type TEXT,
            remark TEXT,
            claim_settlement NUMERIC DEFAULT 0,
            bill_no TEXT,
            bill_date DATE,
            bill_amount NUMERIC(15,2),
            paid_amount NUMERIC(15,2),
            balance_amount NUMERIC(15,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS payment_details DISABLE ROW LEVEL SECURITY;

          -- Ensure payment_master and payment_details have all required columns
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS mr_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS sett_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_type TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS chn_supplier TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arrival_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_amt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_bill_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_bill_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Completed';
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS advance_payment_done TEXT DEFAULT 'No';

          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT true;
          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT true;
          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS settled_by TEXT;

          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS payment_id UUID;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS voucher_no TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS mr_no TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS col_index INT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS marka_crop TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS quantity NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS arr_qty_wt NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS min_qty_wt NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS wt_phota NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS wt_quantity NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS rate_value NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS adjust_type TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS remark TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS claim_settlement NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS sett_pct NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS deduction_rate NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS sett_rate NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS quantity_qtl NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;

          -- Ensure material_mismatch table exists and has all required columns
          CREATE TABLE IF NOT EXISTS material_mismatch (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mismatch_id TEXT UNIQUE,
            po_no TEXT,
            arrival_no TEXT,
            inspection_no TEXT,
            area TEXT,
            grade TEXT,
            supplier TEXT,
            broker TEXT,
            agency TEXT,
            ptf_mode TEXT,
            challan_supplier TEXT,
            rate_per_mt TEXT,
            lorry_number TEXT,
            issue_description TEXT,
            expected_value TEXT,
            actual_value TEXT,
            difference TEXT,
            mismatched_fields TEXT,
            severity TEXT,
            status TEXT DEFAULT 'pending',
            remarks TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_mismatch DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS mismatch_id TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS inspection_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS ptf_mode TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS challan_supplier TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS rate_per_mt TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS issue_description TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS expected_value TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS actual_value TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS difference TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS mismatched_fields TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS severity TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS remarks TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

          CREATE TABLE IF NOT EXISTS satta_mismatch (
            id TEXT PRIMARY KEY,
            mismatch_id TEXT,
            po_no TEXT,
            sauda_no TEXT,
            status TEXT DEFAULT 'dispute',
            remarks TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP WITH TIME ZONE,
            approval_level TEXT DEFAULT 'L3/L5',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS satta_mismatch DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS mismatch_id TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS sauda_no TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS field TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS expected_value TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS actual_value TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS expected_rate NUMERIC;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS actual_rate NUMERIC;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'dispute';
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS remarks TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS satta_mismatch ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS open_remarks JSONB;

          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS open_remarks JSONB;

          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS rejected_by TEXT;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS open_remarks JSONB;

          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS sms_id TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS raw_sms_body TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS sauda_created BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS marked_by TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP WITH TIME ZONE;

          DO $$
          BEGIN
            -- sauda_master units_per_lorry
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'sauda_master' AND column_name = 'units_per_lorry'
            ) THEN
              IF (SELECT data_type FROM information_schema.columns 
                  WHERE table_schema = 'public' AND table_name = 'sauda_master' AND column_name = 'units_per_lorry') IN ('text', 'character varying', 'varchar') THEN
                ALTER TABLE sauda_master 
                ALTER COLUMN units_per_lorry TYPE NUMERIC(15,2) 
                USING (
                  CASE 
                    WHEN trim(units_per_lorry::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN trim(units_per_lorry::text)::numeric 
                    ELSE NULL 
                  END
                );
              END IF;
            ELSE
              ALTER TABLE sauda_master ADD COLUMN IF NOT EXISTS units_per_lorry NUMERIC(15,2);
            END IF;

            -- sms_sauda units_per_lorry
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'sms_sauda' AND column_name = 'units_per_lorry'
            ) THEN
              IF (SELECT data_type FROM information_schema.columns 
                  WHERE table_schema = 'public' AND table_name = 'sms_sauda' AND column_name = 'units_per_lorry') IN ('text', 'character varying', 'varchar') THEN
                ALTER TABLE sms_sauda 
                ALTER COLUMN units_per_lorry TYPE NUMERIC(15,2) 
                USING (
                  CASE 
                    WHEN trim(units_per_lorry::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN trim(units_per_lorry::text)::numeric 
                    ELSE NULL 
                  END
                );
              END IF;
            ELSE
              ALTER TABLE sms_sauda ADD COLUMN IF NOT EXISTS units_per_lorry NUMERIC(15,2);
            END IF;

            -- satta_master units_per_lorry
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'satta_master' AND column_name = 'units_per_lorry'
            ) THEN
              IF (SELECT data_type FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'satta_master' AND column_name = 'units_per_lorry') IN ('text', 'character varying', 'varchar') THEN
                ALTER TABLE satta_master 
                ALTER COLUMN units_per_lorry TYPE NUMERIC(15,2) 
                USING (
                  CASE 
                    WHEN trim(units_per_lorry::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN trim(units_per_lorry::text)::numeric 
                    ELSE NULL 
                  END
                );
              END IF;
            ELSE
              ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS units_per_lorry NUMERIC(15,2);
            END IF;
          END $$;

          DROP VIEW IF EXISTS material_inspection CASCADE;
          DROP TABLE IF EXISTS inspection_master, inspection_details, inspection_checklist, inspection_checklist_details, mill_inspection_master, mill_inspection_detail CASCADE;

          CREATE TABLE IF NOT EXISTS material_inspection (
            mr_no TEXT PRIMARY KEY,
            mr_date DATE,
            date DATE,
            arrival_no TEXT,
            arrival_date DATE,
            po_no TEXT,
            po_date DATE,
            broker_name TEXT,
            supplier_name TEXT,
            actual_moisture NUMERIC,
            claim_moisture NUMERIC,
            actual_dust NUMERIC,
            claim_dust NUMERIC,
            actual_ncv NUMERIC,
            claim_ncv NUMERIC,
            detention_days NUMERIC,
            unloading_date DATE,
            mill_po_no TEXT,
            mill_po_date DATE,
            mr_spcl_print TEXT,
            remarks TEXT,
            lorry_number TEXT,
            delivery_claim NUMERIC DEFAULT 0,
            deduction_type TEXT,
            deduction_rate NUMERIC DEFAULT 0,
            deduction_qty NUMERIC DEFAULT 0,
            deduction_amount NUMERIC DEFAULT 0,
            status TEXT DEFAULT 'Completed',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_inspection DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS broker_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS supplier_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_moisture NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_moisture NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_dust NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_dust NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_ncv NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_ncv NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS detention_days NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unloading_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mill_po_no TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mill_po_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_spcl_print TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS delivery_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_type TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_rate NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_qty NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_types JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS on_account_advance_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS sent_settlement_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_returned TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_print_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS consignment_no TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS consignment_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area_code TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS grid_details JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS details JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_name TEXT DEFAULT 'BALES';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_code TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'BALES';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS marka TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS marks TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quality TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS item_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS item_code TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS rate_qntl NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS gross_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS net_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quality_matrix JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deductions_json TEXT;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS deductions_json TEXT;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS deductions_json TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0;

          CREATE TABLE IF NOT EXISTS mill_inspection_deduction (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mr_no TEXT,
            mr_date DATE,
            po_no TEXT,
            po_date DATE,
            arrival_no TEXT,
            arrival_date DATE,
            supplier TEXT,
            supplier_name TEXT,
            broker TEXT,
            broker_name TEXT,
            lorry_number TEXT,
            deduction_type TEXT,
            deduction_rate NUMERIC(15,2) DEFAULT 0,
            deduction_qty NUMERIC(15,3) DEFAULT 0,
            deduction_amount NUMERIC(15,2) DEFAULT 0,
            unit TEXT DEFAULT 'BALES',
            gross_weight_mt NUMERIC(15,3),
            total_bales NUMERIC(15,2),
            avg_bale_weight NUMERIC(15,2),
            remarks TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS mill_inspection_deduction DISABLE ROW LEVEL SECURITY;
          CREATE INDEX IF NOT EXISTS idx_mill_insp_ded_mr ON mill_inspection_deduction(mr_no);
          CREATE INDEX IF NOT EXISTS idx_mill_insp_ded_po ON mill_inspection_deduction(po_no);
          CREATE INDEX IF NOT EXISTS idx_mill_insp_ded_arr ON mill_inspection_deduction(arrival_no);

          CREATE TABLE IF NOT EXISTS material_inspection_deductions (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            mr_no TEXT,
            po_no TEXT,
            arrival_no TEXT,
            deduction_type TEXT,
            deduction_rate NUMERIC DEFAULT 0,
            deduction_qty NUMERIC DEFAULT 0,
            deduction_amount NUMERIC DEFAULT 0,
            remarks TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_inspection_deductions DISABLE ROW LEVEL SECURITY;
          CREATE INDEX IF NOT EXISTS idx_inspection_deductions_mr ON material_inspection_deductions(mr_no);
          CREATE INDEX IF NOT EXISTS idx_inspection_deductions_arr ON material_inspection_deductions(arrival_no);

          CREATE TABLE IF NOT EXISTS material_inspection_details (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            mr_no TEXT,
            srl_no INTEGER,
            arrival_grade TEXT,
            stock_grade_code TEXT,
            stock_grade_name TEXT,
            area TEXT,
            agency TEXT,
            marka TEXT,
            crop_year TEXT,
            lot TEXT,
            quantity NUMERIC DEFAULT 0,
            unit TEXT DEFAULT 'BALES',
            challan_gross_wt NUMERIC DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_inspection_details DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS arrival_grade TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS stock_grade_code TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS stock_grade_name TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marka TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS crop_year TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lot TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'BALES';
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS challan_gross_wt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS receipt_gross_wt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS gross_weight_batch NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS add_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS less_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS reduced_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_moisture_min NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_moisture_max NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_min NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_max NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_avg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_min NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_max NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_avg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS grade_down_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS grade_down_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS final_receipt_wt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_moisture NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_grade_down NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_dust NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_ncv NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_tot_wt_grd NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_grade TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_tot_wt_grd NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_grade TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS tolerable TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS premium TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS row_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS jqi_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS jci_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marka TEXT;

          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;

          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approval_level TEXT;

          -- Performance Indexes to prevent Disk I/O depletion
          CREATE INDEX IF NOT EXISTS idx_sauda_master_no ON sauda_master(sauda_no);
          CREATE INDEX IF NOT EXISTS idx_sauda_master_created ON sauda_master(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_sms_sauda_no ON sms_sauda(sauda_no);
          CREATE INDEX IF NOT EXISTS idx_sms_sauda_sms_id ON sms_sauda(sms_id);
          CREATE INDEX IF NOT EXISTS idx_sms_sauda_created ON sms_sauda(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_purchase_master_po ON purchase_master(po_no);
          CREATE INDEX IF NOT EXISTS idx_temp_mat_mr ON temporary_material_received(mr_no);
          CREATE INDEX IF NOT EXISTS idx_temp_mat_arr ON temporary_material_received(arrival_no);
          CREATE INDEX IF NOT EXISTS idx_inspection_mr ON material_inspection(mr_no);
          CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
        END $$;
        NOTIFY pgrst, 'reload schema';
      ` 
    });
  } catch (err) {
    console.warn("Startup SQL migration caught error:", err);
  }
}
