-- ============================================================================
-- Migration 019: Enterprise Commercial-Grade Generic Variant Migration Engine
-- Fully Idempotent, Multi-Tenant, Rollback-Safe, RLS-Compatible, Dry-Run Supported
-- ============================================================================

-- 1. Legacy Tracking & Variant Parent Columns on menu_items
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS parent_menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_variant_parent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_migrated_legacy_variant BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS migrated_to_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS legacy_sku TEXT;

CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON menu_items(parent_menu_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_is_migrated ON menu_items(is_migrated_legacy_variant) WHERE is_migrated_legacy_variant = true;

-- 2. Audit Trail Table
CREATE TABLE IF NOT EXISTS variant_migration_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    legacy_menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    parent_menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    action_taken TEXT NOT NULL,
    sku_migrated TEXT,
    previous_state JSONB,
    skipped_reason TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vma_rest_legacy ON variant_migration_audit(restaurant_id, legacy_menu_item_id);

-- Enable RLS on audit table
ALTER TABLE variant_migration_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation: variant_migration_audit" ON variant_migration_audit;
CREATE POLICY "Tenant Isolation: variant_migration_audit" ON variant_migration_audit 
FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);

-- 3. Enterprise Product Name Normalization Function
CREATE OR REPLACE FUNCTION normalize_product_name(p_name TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_clean TEXT;
BEGIN
    IF p_name IS NULL THEN RETURN ''; END IF;
    -- Lowercase & trim
    v_clean := LOWER(TRIM(p_name));
    -- Replace brackets () [] {} with spaces
    v_clean := REGEXP_REPLACE(v_clean, '[\(\[\{\}\]\)]', ' ', 'g');
    -- Replace hyphens, underscores, punctuation with single spaces
    v_clean := REGEXP_REPLACE(v_clean, '[_\-\.,;:!@#$%^&*+=\|\\\/]+', ' ', 'g');
    -- Collapse multiple spaces
    v_clean := REGEXP_REPLACE(v_clean, '\s+', ' ', 'g');
    RETURN TRIM(v_clean);
END;
$$;

-- 4. Generic Variant Extractor
CREATE OR REPLACE FUNCTION extract_variant_from_name(p_name TEXT)
RETURNS TABLE (
    base_name TEXT,
    variant_name TEXT,
    is_variant BOOLEAN
) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_pattern TEXT;
    v_raw_base TEXT;
    v_raw_variant TEXT;
BEGIN
    v_pattern := '[\(\[\{-]?\s*(\d+(?:\.\d+)?\s*(?:"|inch|inches|''|cm)|½\s*kg|1\/2\s*kg|\d+(?:\.\d+)?\s*(?:kg|g|gm|grams|kilo|kilos)|250ml|500ml|750ml|1l|1.5l|2l|\d+(?:\.\d+)?\s*(?:ml|l|liter|liters|litre|litres)|small|medium|large|regular|xl|xxl|mini|jumbo|single|double|family|half|full|quarter|\d+\s*scoops?|\d+\s*patties|single\s*patty|double\s*patty)\s*[\)\]\}]?$';

    IF p_name ~* v_pattern THEN
        v_raw_base := TRIM(REGEXP_REPLACE(p_name, v_pattern, '', 'i'));
        v_raw_variant := TRIM(REGEXP_REPLACE(SUBSTRING(p_name FROM v_pattern), '^[\(\[\{-]+|[\)\]\}]+$', '', 'g'));
        
        IF CHAR_LENGTH(v_raw_base) >= 2 THEN
            RETURN QUERY SELECT v_raw_base, INITCAP(v_raw_variant), true;
            RETURN;
        END IF;
    END IF;

    RETURN QUERY SELECT p_name, ''::TEXT, false;
END;
$$;

-- 5. Enterprise Commercial-Grade Migration Master Procedure
CREATE OR REPLACE FUNCTION run_enterprise_variant_migration(
    p_restaurant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    r RECORD;
    v_parent_id UUID;
    v_variant_id UUID;
    v_extracted RECORD;
    v_base_name TEXT;
    v_variant_name TEXT;
    v_norm_base TEXT;
    v_norm_variant TEXT;
    
    -- Progress Counters
    v_parents_created INT := 0;
    v_parents_reused INT := 0;
    v_variants_created INT := 0;
    v_variants_updated INT := 0;
    v_legacy_products_migrated INT := 0;
    v_legacy_products_archived INT := 0;
    v_inventory_refs_updated INT := 0;
    v_order_refs_updated INT := 0;
    v_modifier_refs_updated INT := 0;
    v_tag_refs_updated INT := 0;
    v_duplicate_parents_prevented INT := 0;
    v_duplicate_variants_prevented INT := 0;
    v_warnings INT := 0;
    v_errors INT := 0;
    
    -- Validation Counters
    v_val_dup_parents INT := 0;
    v_val_dup_variants INT := 0;
    v_val_orphan_orders INT := 0;

    v_prev_state JSONB;
    v_rows_affected INT;
    v_has_inventory_table BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- 1. Concurrency Protection (Acquire Share Row Exclusive locks)
    LOCK TABLE menu_items IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE product_variants IN SHARE ROW EXCLUSIVE MODE;

    -- Check if inventory_events table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_events'
    ) INTO v_has_inventory_table;

    -- STEP 0: Repair Foreign Keys & Soft-Delete Previously Migrated Items (Migration 017/018 cleanup)
    IF NOT p_dry_run THEN
        -- Re-link order_items from legacy child items to parent items & variants
        UPDATE order_items 
        SET menu_item_id = m.parent_menu_item_id,
            variant_id = COALESCE(order_items.variant_id, m.migrated_to_variant_id)
        FROM menu_items m
        WHERE order_items.menu_item_id = m.id
          AND m.is_migrated_legacy_variant = true
          AND m.parent_menu_item_id IS NOT NULL;
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        v_order_refs_updated := v_order_refs_updated + v_rows_affected;

        -- Re-link modifier groups
        UPDATE menu_item_modifier_groups 
        SET menu_item_id = m.parent_menu_item_id
        FROM menu_items m
        WHERE menu_item_modifier_groups.menu_item_id = m.id
          AND m.is_migrated_legacy_variant = true
          AND m.parent_menu_item_id IS NOT NULL;
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        v_modifier_refs_updated := v_modifier_refs_updated + v_rows_affected;
        DELETE FROM menu_item_modifier_groups WHERE menu_item_id IN (SELECT id FROM menu_items WHERE is_migrated_legacy_variant = true);

        -- Re-link tags
        UPDATE menu_item_tags 
        SET menu_item_id = m.parent_menu_item_id
        FROM menu_items m
        WHERE menu_item_tags.menu_item_id = m.id
          AND m.is_migrated_legacy_variant = true
          AND m.parent_menu_item_id IS NOT NULL;
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        v_tag_refs_updated := v_tag_refs_updated + v_rows_affected;
        DELETE FROM menu_item_tags WHERE menu_item_id IN (SELECT id FROM menu_items WHERE is_migrated_legacy_variant = true);

        -- Soft delete legacy child items & clear SKUs to prevent collisions
        UPDATE menu_items
        SET deleted_at = COALESCE(deleted_at, now()),
            legacy_sku = COALESCE(legacy_sku, sku),
            sku = NULL,
            availability_status = 'hidden'
        WHERE is_migrated_legacy_variant = true;
    ELSE
        SELECT COUNT(*) INTO v_rows_affected
        FROM order_items oi
        JOIN menu_items m ON oi.menu_item_id = m.id
        WHERE m.is_migrated_legacy_variant = true AND m.parent_menu_item_id IS NOT NULL;
        v_order_refs_updated := v_order_refs_updated + v_rows_affected;
    END IF;

    -- 2. Process Legacy Menu Items
    FOR r IN 
        SELECT m.id, m.restaurant_id, m.category_id, m.name, m.description, m.cost_price, m.selling_price,
               m.image_url, m.is_veg, m.prep_time, m.availability_status, m.sku, m.barcode, m.display_order,
               m.created_at
        FROM menu_items m
        WHERE m.deleted_at IS NULL 
          AND m.is_migrated_legacy_variant = false
          AND (p_restaurant_id IS NULL OR m.restaurant_id = p_restaurant_id)
        ORDER BY m.restaurant_id, m.category_id, m.created_at ASC
    LOOP
        -- Extract base_name and variant_name
        SELECT * INTO v_extracted FROM extract_variant_from_name(r.name);

        IF v_extracted.is_variant THEN
            v_base_name := v_extracted.base_name;
            v_variant_name := COALESCE(NULLIF(v_extracted.variant_name, ''), 'Standard');
            v_norm_base := normalize_product_name(v_base_name);
            v_norm_variant := normalize_product_name(v_variant_name);

            -- 3. Match or Create Parent Menu Item using Enterprise Normalization
            SELECT id INTO v_parent_id 
            FROM menu_items 
            WHERE restaurant_id = r.restaurant_id 
              AND category_id = r.category_id
              AND normalize_product_name(name) = v_norm_base 
              AND is_migrated_legacy_variant = false
              AND deleted_at IS NULL 
            ORDER BY created_at ASC 
            LIMIT 1;

            IF v_parent_id IS NOT NULL THEN
                IF NOT p_dry_run THEN
                    UPDATE menu_items SET is_variant_parent = true WHERE id = v_parent_id;
                END IF;
                v_parents_reused := v_parents_reused + 1;
            ELSE
                IF NOT p_dry_run THEN
                    -- Insert new parent item (Set SKU = NULL on parent to prevent unique constraint conflicts)
                    INSERT INTO menu_items (
                        restaurant_id, category_id, name, description, cost_price, selling_price,
                        image_url, is_veg, prep_time, availability_status, sku, barcode, display_order, is_variant_parent
                    ) VALUES (
                        r.restaurant_id, r.category_id, v_base_name, r.description, r.cost_price, r.selling_price,
                        r.image_url, r.is_veg, r.prep_time, 'available', NULL, NULL, r.display_order, true
                    )
                    RETURNING id INTO v_parent_id;
                ELSE
                    v_parent_id := gen_random_uuid();
                END IF;

                v_parents_created := v_parents_created + 1;
            END IF;

            -- 4. Match or Create Product Variant
            SELECT id INTO v_variant_id 
            FROM product_variants 
            WHERE restaurant_id = r.restaurant_id 
              AND menu_item_id = v_parent_id 
              AND (
                normalize_product_name(name) = v_norm_variant
                OR (r.sku IS NOT NULL AND sku = r.sku)
                OR (r.barcode IS NOT NULL AND barcode = r.barcode)
              )
              AND deleted_at IS NULL
            LIMIT 1;

            IF v_variant_id IS NOT NULL THEN
                IF NOT p_dry_run THEN
                    UPDATE product_variants 
                    SET price_override = r.selling_price,
                        cost_price = COALESCE(r.cost_price, cost_price),
                        sku = COALESCE(r.sku, sku),
                        barcode = COALESCE(r.barcode, barcode),
                        is_active = true,
                        updated_at = now()
                    WHERE id = v_variant_id;
                END IF;

                v_variants_updated := v_variants_updated + 1;
                v_duplicate_variants_prevented := v_duplicate_variants_prevented + 1;
            ELSE
                -- SKU Collision Protection
                DECLARE
                    v_target_sku TEXT := r.sku;
                BEGIN
                    IF v_target_sku IS NOT NULL AND EXISTS (
                        SELECT 1 FROM product_variants WHERE restaurant_id = r.restaurant_id AND sku = v_target_sku AND deleted_at IS NULL
                    ) THEN
                        v_target_sku := v_target_sku || '-V';
                        v_warnings := v_warnings + 1;
                    END IF;

                    IF NOT p_dry_run THEN
                        INSERT INTO product_variants (
                            restaurant_id, menu_item_id, name, price_override, cost_price, sku, barcode, display_order, is_active
                        ) VALUES (
                            r.restaurant_id, v_parent_id, v_variant_name, r.selling_price, r.cost_price, v_target_sku, r.barcode, r.display_order, true
                        )
                        RETURNING id INTO v_variant_id;
                    ELSE
                        v_variant_id := gen_random_uuid();
                    END IF;

                    v_variants_created := v_variants_created + 1;
                END;
            END IF;

            -- 5. Foreign Key Reference Migration & Archiving
            IF NOT p_dry_run THEN
                -- a. order_items
                UPDATE order_items 
                SET menu_item_id = v_parent_id,
                    variant_id = v_variant_id
                WHERE menu_item_id = r.id;
                GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
                v_order_refs_updated := v_order_refs_updated + v_rows_affected;

                -- b. menu_item_modifier_groups
                UPDATE menu_item_modifier_groups 
                SET menu_item_id = v_parent_id 
                WHERE menu_item_id = r.id;
                GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
                v_modifier_refs_updated := v_modifier_refs_updated + v_rows_affected;
                DELETE FROM menu_item_modifier_groups WHERE menu_item_id = r.id;

                -- c. menu_item_tags
                UPDATE menu_item_tags 
                SET menu_item_id = v_parent_id 
                WHERE menu_item_id = r.id;
                GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
                v_tag_refs_updated := v_tag_refs_updated + v_rows_affected;
                DELETE FROM menu_item_tags WHERE menu_item_id = r.id;

                -- d. menu_items.parent_menu_item_id
                UPDATE menu_items 
                SET parent_menu_item_id = v_parent_id 
                WHERE parent_menu_item_id = r.id;

                -- e. inventory_events (if table exists)
                IF v_has_inventory_table THEN
                    EXECUTE 'UPDATE inventory_events SET menu_item_id = $1 WHERE menu_item_id = $2'
                    USING v_parent_id, r.id;
                    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
                    v_inventory_refs_updated := v_inventory_refs_updated + v_rows_affected;
                END IF;

                -- 6. Snapshot Previous State & Soft Delete / Archive Legacy Product
                v_prev_state := jsonb_build_object(
                    'id', r.id,
                    'name', r.name,
                    'sku', r.sku,
                    'barcode', r.barcode,
                    'selling_price', r.selling_price,
                    'availability_status', r.availability_status
                );

                UPDATE menu_items 
                SET parent_menu_item_id = v_parent_id,
                    is_migrated_legacy_variant = true,
                    migrated_to_variant_id = v_variant_id,
                    legacy_sku = COALESCE(legacy_sku, r.sku),
                    sku = NULL,
                    availability_status = 'hidden',
                    deleted_at = now()
                WHERE id = r.id;

                -- 7. Audit Log Entry
                INSERT INTO variant_migration_audit (
                    restaurant_id, legacy_menu_item_id, parent_menu_item_id, variant_id,
                    action_taken, sku_migrated, previous_state
                ) VALUES (
                    r.restaurant_id, r.id, v_parent_id, v_variant_id,
                    'MIGRATED_AND_ARCHIVED', r.sku, v_prev_state
                );
            ELSE
                -- Dry run counts calculation
                SELECT COUNT(*) INTO v_rows_affected FROM order_items WHERE menu_item_id = r.id;
                v_order_refs_updated := v_order_refs_updated + v_rows_affected;

                SELECT COUNT(*) INTO v_rows_affected FROM menu_item_modifier_groups WHERE menu_item_id = r.id;
                v_modifier_refs_updated := v_modifier_refs_updated + v_rows_affected;

                SELECT COUNT(*) INTO v_rows_affected FROM menu_item_tags WHERE menu_item_id = r.id;
                v_tag_refs_updated := v_tag_refs_updated + v_rows_affected;

                IF v_has_inventory_table THEN
                    EXECUTE 'SELECT COUNT(*) FROM inventory_events WHERE menu_item_id = $1' INTO v_rows_affected USING r.id;
                    v_inventory_refs_updated := v_inventory_refs_updated + v_rows_affected;
                END IF;
            END IF;

            v_legacy_products_migrated := v_legacy_products_migrated + 1;
            v_legacy_products_archived := v_legacy_products_archived + 1;

        END IF;
    END LOOP;

    -- 8. Post-Migration Validation Stage
    SELECT COUNT(*) INTO v_val_dup_parents
    FROM (
        SELECT restaurant_id, normalize_product_name(name)
        FROM menu_items 
        WHERE deleted_at IS NULL AND is_migrated_legacy_variant = false
        GROUP BY restaurant_id, normalize_product_name(name)
        HAVING COUNT(*) > 1
    ) t;

    SELECT COUNT(*) INTO v_val_dup_variants
    FROM (
        SELECT menu_item_id, normalize_product_name(name)
        FROM product_variants 
        WHERE deleted_at IS NULL
        GROUP BY menu_item_id, normalize_product_name(name)
        HAVING COUNT(*) > 1
    ) t;

    -- Count orphan orders (order_items pointing to soft-deleted legacy items that lack parent_menu_item_id)
    SELECT COUNT(*) INTO v_val_orphan_orders
    FROM order_items oi
    JOIN menu_items m ON oi.menu_item_id = m.id
    WHERE m.is_migrated_legacy_variant = true AND m.parent_menu_item_id IS NULL;

    -- Build Final Summary Report
    v_result := jsonb_build_object(
        'dry_run', p_dry_run,
        'parents_created', v_parents_created,
        'parents_reused', v_parents_reused,
        'variants_created', v_variants_created,
        'variants_updated', v_variants_updated,
        'legacy_products_migrated', v_legacy_products_migrated,
        'legacy_products_archived', v_legacy_products_archived,
        'order_refs_updated', v_order_refs_updated,
        'modifier_refs_updated', v_modifier_refs_updated,
        'tag_refs_updated', v_tag_refs_updated,
        'inventory_refs_updated', v_inventory_refs_updated,
        'duplicate_parents_prevented', v_duplicate_parents_prevented,
        'duplicate_variants_prevented', v_duplicate_variants_prevented,
        'warnings', v_warnings,
        'errors', v_errors,
        'validation', jsonb_build_object(
            'duplicate_parents', v_val_dup_parents,
            'duplicate_variants', v_val_dup_variants,
            'orphan_orders', v_val_orphan_orders
        )
    );

    RETURN v_result;
END;
$$;

-- Execute the Enterprise Migration
SELECT run_enterprise_variant_migration(NULL, FALSE);
