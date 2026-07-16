-- ============================================================
-- FIX ALL RLS POLICIES - Run this in Supabase Dashboard SQL Editor
-- Change: auth.jwt() ->> 'restaurant_id'  
-- To:     COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id')
-- ============================================================

-- restaurants
DROP POLICY IF EXISTS "tenant_select" ON restaurants;
DROP POLICY IF EXISTS "tenant_insert" ON restaurants;
DROP POLICY IF EXISTS "tenant_update" ON restaurants;
CREATE POLICY "tenant_select" ON restaurants FOR SELECT USING (id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON restaurants FOR INSERT WITH CHECK (id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON restaurants FOR UPDATE USING (id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- restaurant_settings
DROP POLICY IF EXISTS "tenant_select" ON restaurant_settings;
DROP POLICY IF EXISTS "tenant_insert" ON restaurant_settings;
DROP POLICY IF EXISTS "tenant_update" ON restaurant_settings;
CREATE POLICY "tenant_select" ON restaurant_settings FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_insert" ON restaurant_settings FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON restaurant_settings FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- users
DROP POLICY IF EXISTS "tenant_select" ON users;
DROP POLICY IF EXISTS "tenant_insert" ON users;
DROP POLICY IF EXISTS "tenant_update" ON users;
CREATE POLICY "tenant_select" ON users FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON users FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON users FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- roles
DROP POLICY IF EXISTS "tenant_select" ON roles;
DROP POLICY IF EXISTS "tenant_insert" ON roles;
DROP POLICY IF EXISTS "tenant_update" ON roles;
CREATE POLICY "tenant_select" ON roles FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON roles FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON roles FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- permissions
DROP POLICY IF EXISTS "tenant_select" ON permissions;
DROP POLICY IF EXISTS "tenant_insert" ON permissions;
DROP POLICY IF EXISTS "tenant_update" ON permissions;
CREATE POLICY "tenant_select" ON permissions FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_insert" ON permissions FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON permissions FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- floors
DROP POLICY IF EXISTS "tenant_select" ON floors;
DROP POLICY IF EXISTS "tenant_insert" ON floors;
DROP POLICY IF EXISTS "tenant_update" ON floors;
CREATE POLICY "tenant_select" ON floors FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON floors FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON floors FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- tables
DROP POLICY IF EXISTS "tenant_select" ON tables;
DROP POLICY IF EXISTS "tenant_insert" ON tables;
DROP POLICY IF EXISTS "tenant_update" ON tables;
CREATE POLICY "tenant_select" ON tables FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON tables FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON tables FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- categories
DROP POLICY IF EXISTS "tenant_select" ON categories;
DROP POLICY IF EXISTS "tenant_insert" ON categories;
DROP POLICY IF EXISTS "tenant_update" ON categories;
CREATE POLICY "tenant_select" ON categories FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON categories FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON categories FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- tags
DROP POLICY IF EXISTS "tags_select" ON tags;
DROP POLICY IF EXISTS "tenant_select" ON tags;
DROP POLICY IF EXISTS "tenant_insert" ON tags;
DROP POLICY IF EXISTS "tenant_update" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT USING (restaurant_id IS NULL OR restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_insert" ON tags FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON tags FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- menu_items
DROP POLICY IF EXISTS "tenant_select" ON menu_items;
DROP POLICY IF EXISTS "tenant_insert" ON menu_items;
DROP POLICY IF EXISTS "tenant_update" ON menu_items;
CREATE POLICY "tenant_select" ON menu_items FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON menu_items FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON menu_items FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- menu_item_tags
DROP POLICY IF EXISTS "tenant_select" ON menu_item_tags;
DROP POLICY IF EXISTS "tenant_insert" ON menu_item_tags;
DROP POLICY IF EXISTS "tenant_update" ON menu_item_tags;
CREATE POLICY "tenant_select" ON menu_item_tags FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_insert" ON menu_item_tags FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON menu_item_tags FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- orders
DROP POLICY IF EXISTS "tenant_select" ON orders;
DROP POLICY IF EXISTS "tenant_insert" ON orders;
DROP POLICY IF EXISTS "tenant_update" ON orders;
CREATE POLICY "tenant_select" ON orders FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON orders FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON orders FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- order_items
DROP POLICY IF EXISTS "tenant_select" ON order_items;
DROP POLICY IF EXISTS "tenant_insert" ON order_items;
DROP POLICY IF EXISTS "tenant_update" ON order_items;
CREATE POLICY "tenant_select" ON order_items FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON order_items FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_update" ON order_items FOR UPDATE USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- activity_logs
DROP POLICY IF EXISTS "tenant_select" ON activity_logs;
DROP POLICY IF EXISTS "tenant_insert" ON activity_logs;
CREATE POLICY "tenant_select" ON activity_logs FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);
CREATE POLICY "tenant_insert" ON activity_logs FOR INSERT WITH CHECK (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);

-- audit_logs
DROP POLICY IF EXISTS "tenant_select" ON audit_logs;
CREATE POLICY "tenant_select" ON audit_logs FOR SELECT USING (restaurant_id = (COALESCE(auth.jwt()->'user_metadata'->>'restaurant_id', auth.jwt()->>'restaurant_id'))::uuid);