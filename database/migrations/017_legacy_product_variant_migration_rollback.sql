-- Rollback Migration 017: Restore Legacy Items and Remove Created Variants

-- 1. Un-hide legacy migrated items
UPDATE menu_items 
SET availability_status = 'available',
    is_migrated_legacy_variant = false,
    parent_menu_item_id = NULL,
    migrated_to_variant_id = NULL
WHERE is_migrated_legacy_variant = true;

-- 2. Delete generated product_variants
DELETE FROM product_variants WHERE created_at >= NOW() - INTERVAL '1 day';

-- 3. Delete generated parent menu items
DELETE FROM menu_items WHERE is_variant_parent = true AND created_at >= NOW() - INTERVAL '1 day';
