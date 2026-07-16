-- ============================================================
-- SQL Fix for Phase 2 RLS Policies
-- Run this in your Supabase Dashboard SQL Editor
-- ============================================================

-- Helper macro for the restaurant_id comparison:
-- (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid

-- 1. tax_profiles
DROP POLICY IF EXISTS tax_profiles_restaurant_isolation ON tax_profiles;
CREATE POLICY tax_profiles_restaurant_isolation ON tax_profiles
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 2. payment_methods
DROP POLICY IF EXISTS payment_methods_restaurant_isolation ON payment_methods;
CREATE POLICY payment_methods_restaurant_isolation ON payment_methods
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 3. feature_flags
DROP POLICY IF EXISTS feature_flags_restaurant_isolation ON feature_flags;
CREATE POLICY feature_flags_restaurant_isolation ON feature_flags
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 4. printers
DROP POLICY IF EXISTS printers_restaurant_isolation ON printers;
CREATE POLICY printers_restaurant_isolation ON printers
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 5. printer_jobs
DROP POLICY IF EXISTS printer_jobs_restaurant_isolation ON printer_jobs;
CREATE POLICY printer_jobs_restaurant_isolation ON printer_jobs
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 6. customers
DROP POLICY IF EXISTS customers_restaurant_isolation ON customers;
CREATE POLICY customers_restaurant_isolation ON customers
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 7. receipt_customizations
DROP POLICY IF EXISTS receipt_customizations_restaurant_isolation ON receipt_customizations;
CREATE POLICY receipt_customizations_restaurant_isolation ON receipt_customizations
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 8. receipt_number_rules
DROP POLICY IF EXISTS receipt_number_rules_restaurant_isolation ON receipt_number_rules;
CREATE POLICY receipt_number_rules_restaurant_isolation ON receipt_number_rules
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 9. kots
DROP POLICY IF EXISTS kots_restaurant_isolation ON kots;
CREATE POLICY kots_restaurant_isolation ON kots
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 10. inventory_events
DROP POLICY IF EXISTS inventory_events_restaurant_isolation ON inventory_events;
CREATE POLICY inventory_events_restaurant_isolation ON inventory_events
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 11. discount_role_limits
DROP POLICY IF EXISTS discount_role_limits_restaurant_isolation ON discount_role_limits;
CREATE POLICY discount_role_limits_restaurant_isolation ON discount_role_limits
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- 12. payments
DROP POLICY IF EXISTS payments_restaurant_isolation ON payments;
CREATE POLICY payments_restaurant_isolation ON payments
  USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
