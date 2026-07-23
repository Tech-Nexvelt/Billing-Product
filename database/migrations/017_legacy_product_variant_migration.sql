-- Migration 017: Enterprise Legacy Product Migration → Generic Variant Engine

-- 1. Add Legacy Tracking & Variant Parent Columns to menu_items
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS parent_menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_variant_parent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_migrated_legacy_variant BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS migrated_to_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_parent ON menu_items(parent_menu_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_migrated ON menu_items(is_migrated_legacy_variant) WHERE is_migrated_legacy_variant = true;

-- 2. Idempotent Migration Transaction Block
DO $$
DECLARE
    r RECORD;
    v_parent_id UUID;
    v_variant_id UUID;
BEGIN
    -- Migration Loop for Legacy Variant Patterns (Sizes, Weights, Volumes, Cup sizes)
    FOR r IN 
        SELECT m.id, m.restaurant_id, m.name, m.selling_price, m.cost_price, m.sku, m.barcode, m.display_order,
               REGEXP_REPLACE(m.name, '\s*[\(\[\{-]?\s*(\d+(?:\.\d+)?\s*(?:"|inch|inches|small|medium|large|½\s*kg|1\s*kg|2\s*kg|250ml|500ml|1l))\s*[\)\]\}]?$', '', 'i') AS base_name,
               SUBSTRING(m.name FROM '[\(\[\{-]?\s*(\d+(?:\.\d+)?\s*(?:"|inch|inches|small|medium|large|½\s*kg|1\s*kg|2\s*kg|250ml|500ml|1l))\s*[\)\]\}]?$') AS raw_variant
        FROM menu_items m
        WHERE m.deleted_at IS NULL 
          AND m.is_migrated_legacy_variant = false
          AND m.name ~* '[\(\[\{-]?\s*(\d+(?:\.\d+)?\s*(?:"|inch|inches|small|medium|large|½\s*kg|1\s*kg|2\s*kg|250ml|500ml|1l))\s*[\)\]\}]?$'
    LOOP
        -- Find or create parent menu_item with base_name
        SELECT id INTO v_parent_id 
        FROM menu_items 
        WHERE restaurant_id = r.restaurant_id 
          AND LOWER(TRIM(name)) = LOWER(TRIM(r.base_name)) 
          AND is_migrated_legacy_variant = false
          AND deleted_at IS NULL 
        LIMIT 1;

        IF v_parent_id IS NULL THEN
            -- Create new Parent Menu Item (Set parent sku = NULL to prevent unique constraint collision with variant SKU)
            INSERT INTO menu_items (
                restaurant_id, category_id, name, description, cost_price, selling_price,
                image_url, is_veg, prep_time, availability_status, sku, barcode, display_order, is_variant_parent
            )
            SELECT r.restaurant_id, category_id, r.base_name, description, cost_price, selling_price,
                   image_url, is_veg, prep_time, availability_status, NULL, barcode, display_order, true
            FROM menu_items WHERE id = r.id
            RETURNING id INTO v_parent_id;
        ELSE
            UPDATE menu_items SET is_variant_parent = true WHERE id = v_parent_id;
        END IF;

        -- Insert Product Variant for this item (transfers original SKU to product_variant)
        INSERT INTO product_variants (
            restaurant_id, menu_item_id, name, price_override, cost_price, sku, barcode, display_order, is_active
        ) VALUES (
            r.restaurant_id, v_parent_id, COALESCE(TRIM(r.raw_variant), 'Standard'), r.selling_price, r.cost_price, r.sku, r.barcode, r.display_order, true
        )
        RETURNING id INTO v_variant_id;

        -- Mark legacy child item as migrated, clear child SKU to free up unique constraint, and link to parent/variant
        UPDATE menu_items 
        SET parent_menu_item_id = v_parent_id,
            is_migrated_legacy_variant = true,
            migrated_to_variant_id = v_variant_id,
            sku = NULL,
            availability_status = 'hidden'
        WHERE id = r.id;
    END LOOP;
END $$;
