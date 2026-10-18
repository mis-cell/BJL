-- Run after linking operator profiles to Supabase Auth accounts (see AUTHENTICATION.md).
-- This migration intentionally removes legacy plaintext credentials. Back up before applying.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

ALTER TABLE public.user_master ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id);
ALTER TABLE public.user_master ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.user_master ADD COLUMN IF NOT EXISTS status text DEFAULT 'Inactive';
ALTER TABLE public.user_master ADD COLUMN IF NOT EXISTS role text DEFAULT 'USER';
ALTER TABLE public.user_master ADD COLUMN IF NOT EXISTS level text DEFAULT 'L1';
ALTER TABLE public.user_master ADD COLUMN IF NOT EXISTS allowed_modules text DEFAULT '[]';
ALTER TABLE public.user_master DROP COLUMN IF EXISTS password;
ALTER TABLE public.user_master DROP COLUMN IF EXISTS password_hash;
-- Unlinked accounts receive no access, regardless of legacy defaults.
UPDATE public.user_master SET status = 'Inactive' WHERE auth_user_id IS NULL;

CREATE TABLE IF NOT EXISTS app_private.resource_modules (
  resource text PRIMARY KEY,
  modules text[] NOT NULL
);
REVOKE ALL ON app_private.resource_modules FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.can_access(resource_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE p public.user_master; required text[]; allowed jsonb;
BEGIN
  SELECT * INTO p FROM public.user_master WHERE auth_user_id = auth.uid();
  IF NOT FOUND OR lower(coalesce(p.status, '')) <> 'active' THEN RETURN false; END IF;
  IF upper(coalesce(p.role,'')) IN ('ADMIN','ADMINISTRATOR') OR upper(coalesce(p.level,'')) = 'L5' THEN RETURN true; END IF;
  IF resource_name = 'user_master' THEN RETURN false; END IF;
  SELECT modules INTO required FROM app_private.resource_modules WHERE resource = resource_name;
  IF required IS NULL THEN RETURN false; END IF;
  BEGIN
    allowed := CASE WHEN left(trim(coalesce(p.allowed_modules::text,'')),1) = '['
      THEN p.allowed_modules::text::jsonb
      ELSE to_jsonb(string_to_array(coalesce(p.allowed_modules::text,''), ',')) END;
  EXCEPTION WHEN OTHERS THEN RETURN false; END;
  RETURN allowed ? '*' OR EXISTS (SELECT 1 FROM unnest(required) m WHERE allowed ? m);
END $$;
REVOKE ALL ON FUNCTION app_private.can_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_access(text) TO authenticated;

-- Explicit table-to-module grants. Unlisted tables are administrator-only.
INSERT INTO app_private.resource_modules(resource,modules) VALUES
 ('sauda_master',ARRAY['sauda','po','final_po']),
 ('sauda_quality_details',ARRAY['sauda','po','final_po']),
 ('sms_sauda',ARRAY['sms_sauda']),
 ('sauda_check_point',ARRAY['po']), ('sauda_check_point_details',ARRAY['po']),
 ('purchase_master',ARRAY['final_po','amad','final_arrival','payment']),
 ('purchase_detail_master',ARRAY['final_po','amad','final_arrival']),
 ('temporary_po',ARRAY['po']), ('temporary_po_details',ARRAY['po']),
 ('temporary_material_received',ARRAY['amad','final_arrival']),
 ('final_arrival',ARRAY['final_arrival','material_inspection']),
 ('inspection_master',ARRAY['material_inspection','inspection','mr_settlement','payment']),
 ('inspection_details',ARRAY['material_inspection','inspection','mr_settlement']),
 ('inspection_checklist',ARRAY['material_inspection']), ('inspection_checklist_details',ARRAY['material_inspection']),
 ('mill_inspection_master',ARRAY['inspection']), ('mill_inspection_detail',ARRAY['inspection']),
 ('payment_master',ARRAY['payment']), ('payment_details',ARRAY['payment']),
 ('mr_settlement_master',ARRAY['mr_settlement']), ('mr_settlement_detail',ARRAY['mr_settlement']),
 ('satta_master',ARRAY['satta']), ('satta_base_rates',ARRAY['satta']),
 ('satta_differentials',ARRAY['satta']), ('satta_calculated_rates',ARRAY['satta']),
 ('imap_emails',ARRAY['sauda']), ('mail_logs',ARRAY['sauda','final_po']),
 ('supply_master',ARRAY['sauda','po','final_po','vyapari']),
 ('broker_master',ARRAY['sauda','po','final_po','vyapari']),
 ('customer_master',ARRAY['vyapari']), ('area_master',ARRAY['sauda','po','final_po','amad','material_inspection']),
 ('grade_master',ARRAY['sauda','po','final_po','material_inspection']),
 ('agency_master',ARRAY['sauda','po','final_po','material_inspection']),
 ('financial_year_master',ARRAY['dashboard']),
 ('godown_master',ARRAY['bardana','issue','closing_stock']),
 ('opening_stock',ARRAY['closing_stock']), ('closing_stock',ARRAY['closing_stock'])
ON CONFLICT(resource) DO UPDATE SET modules=excluded.modules;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Remove every pre-existing policy so permissive legacy policies cannot bypass these.
DO $$ DECLARE t record; p record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t.tablename);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t.tablename LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t.tablename);
    END LOOP;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t.tablename);
    IF t.tablename='user_master' THEN
      EXECUTE 'CREATE POLICY profile_read ON public.user_master FOR SELECT TO authenticated USING (auth_user_id=auth.uid() OR app_private.can_access(''user_master''))';
      EXECUTE 'CREATE POLICY profile_admin ON public.user_master FOR ALL TO authenticated USING (app_private.can_access(''user_master'')) WITH CHECK (app_private.can_access(''user_master''))';
    ELSE
      EXECUTE format('CREATE POLICY module_access ON public.%I FOR ALL TO authenticated USING (app_private.can_access(%L)) WITH CHECK (app_private.can_access(%L))',t.tablename,t.tablename,t.tablename);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- No arbitrary SQL execution or unreviewed SECURITY DEFINER RPCs from the website.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
COMMIT;
