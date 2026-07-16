-- ============================================================
-- SQL Fix for All RLS Policies using current_restaurant_id()
-- Run this in your Supabase Dashboard SQL Editor
-- ============================================================

-- 1. users
DROP POLICY IF EXISTS tenant_select ON users;
DROP POLICY IF EXISTS tenant_insert ON users;
DROP POLICY IF EXISTS tenant_update ON users;
CREATE POLICY tenant_select ON users FOR SELECT USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);
CREATE POLICY tenant_insert ON users FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON users FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 2. roles
DROP POLICY IF EXISTS tenant_select ON roles;
DROP POLICY IF EXISTS tenant_insert ON roles;
DROP POLICY IF EXISTS tenant_update ON roles;
CREATE POLICY tenant_select ON roles FOR SELECT USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);
CREATE POLICY tenant_insert ON roles FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON roles FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 3. permissions
DROP POLICY IF EXISTS tenant_select ON permissions;
DROP POLICY IF EXISTS tenant_insert ON permissions;
DROP POLICY IF EXISTS tenant_update ON permissions;
CREATE POLICY tenant_select ON permissions FOR SELECT USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_insert ON permissions FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON permissions FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 4. categories
DROP POLICY IF EXISTS tenant_select ON categories;
DROP POLICY IF EXISTS tenant_insert ON categories;
DROP POLICY IF EXISTS tenant_update ON categories;
CREATE POLICY tenant_select ON categories FOR SELECT USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);
CREATE POLICY tenant_insert ON categories FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON categories FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 5. tags
DROP POLICY IF EXISTS tags_select ON tags;
DROP POLICY IF EXISTS tenant_insert ON tags;
DROP POLICY IF EXISTS tenant_update ON tags;
CREATE POLICY tags_select ON tags FOR SELECT USING (restaurant_id IS NULL OR restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_insert ON tags FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON tags FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 6. menu_items
DROP POLICY IF EXISTS tenant_select ON menu_items;
DROP POLICY IF EXISTS tenant_insert ON menu_items;
DROP POLICY IF EXISTS tenant_update ON menu_items;
CREATE POLICY tenant_select ON menu_items FOR SELECT USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);
CREATE POLICY tenant_insert ON menu_items FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON menu_items FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 7. menu_item_tags
DROP POLICY IF EXISTS tenant_select ON menu_item_tags;
DROP POLICY IF EXISTS tenant_insert ON menu_item_tags;
DROP POLICY IF EXISTS tenant_update ON menu_item_tags;
CREATE POLICY tenant_select ON menu_item_tags FOR SELECT USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_insert ON menu_item_tags FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON menu_item_tags FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 8. orders
DROP POLICY IF EXISTS tenant_select ON orders;
DROP POLICY IF EXISTS tenant_insert ON orders;
DROP POLICY IF EXISTS tenant_update ON orders;
CREATE POLICY tenant_select ON orders FOR SELECT USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);
CREATE POLICY tenant_insert ON orders FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON orders FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 9. order_items
DROP POLICY IF EXISTS tenant_select ON order_items;
DROP POLICY IF EXISTS tenant_insert ON order_items;
DROP POLICY IF EXISTS tenant_update ON order_items;
CREATE POLICY tenant_select ON order_items FOR SELECT USING (restaurant_id = public.current_restaurant_id() AND deleted_at IS NULL);
CREATE POLICY tenant_insert ON order_items FOR INSERT WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY tenant_update ON order_items FOR UPDATE USING (restaurant_id = public.current_restaurant_id()) WITH CHECK (restaurant_id = public.current_restaurant_id());

-- 10. activity_logs
DROP POLICY IF EXISTS tenant_select ON activity_logs;
CREATE POLICY tenant_select ON activity_logs FOR SELECT USING (restaurant_id = public.current_restaurant_id());

-- 11. audit_logs
DROP POLICY IF EXISTS tenant_select ON audit_logs;
CREATE POLICY tenant_select ON audit_logs FOR SELECT USING (restaurant_id = public.current_restaurant_id());

-- 12. tax_profiles
DROP POLICY IF EXISTS tax_profiles_restaurant_isolation ON tax_profiles;
CREATE POLICY tax_profiles_restaurant_isolation ON tax_profiles FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 13. payment_methods
DROP POLICY IF EXISTS payment_methods_restaurant_isolation ON payment_methods;
CREATE POLICY payment_methods_restaurant_isolation ON payment_methods FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 14. feature_flags
DROP POLICY IF EXISTS feature_flags_restaurant_isolation ON feature_flags;
CREATE POLICY feature_flags_restaurant_isolation ON feature_flags FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 15. printers
DROP POLICY IF EXISTS printers_restaurant_isolation ON printers;
CREATE POLICY printers_restaurant_isolation ON printers FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 16. printer_jobs
DROP POLICY IF EXISTS printer_jobs_restaurant_isolation ON printer_jobs;
CREATE POLICY printer_jobs_restaurant_isolation ON printer_jobs FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 17. customers
DROP POLICY IF EXISTS customers_restaurant_isolation ON customers;
CREATE POLICY customers_restaurant_isolation ON customers FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 18. receipt_customizations
DROP POLICY IF EXISTS receipt_customizations_restaurant_isolation ON receipt_customizations;
CREATE POLICY receipt_customizations_restaurant_isolation ON receipt_customizations FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 19. receipt_number_rules
DROP POLICY IF EXISTS receipt_number_rules_restaurant_isolation ON receipt_number_rules;
CREATE POLICY receipt_number_rules_restaurant_isolation ON receipt_number_rules FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 20. kots
DROP POLICY IF EXISTS kots_restaurant_isolation ON kots;
CREATE POLICY kots_restaurant_isolation ON kots FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 21. inventory_events
DROP POLICY IF EXISTS inventory_events_restaurant_isolation ON inventory_events;
CREATE POLICY inventory_events_restaurant_isolation ON inventory_events FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 22. discount_role_limits
DROP POLICY IF EXISTS discount_role_limits_restaurant_isolation ON discount_role_limits;
CREATE POLICY discount_role_limits_restaurant_isolation ON discount_role_limits FOR ALL USING (restaurant_id = public.current_restaurant_id());

-- 23. payments
DROP POLICY IF EXISTS payments_restaurant_isolation ON payments;
CREATE POLICY payments_restaurant_isolation ON payments FOR ALL USING (restaurant_id = public.current_restaurant_id());
