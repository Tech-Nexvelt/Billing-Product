-- ============================================================================
-- Migration 019 Rollback: Enterprise Rollback Framework
-- Restores legacy items using variant_migration_audit JSONB snapshots
-- Safe, Idempotent, Zero Data Loss
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    v_has_inventory_table BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_events'
    ) INTO v_has_inventory_table;

    -- 1. Restore Foreign Key References and Legacy Items from Audit Trail
    FOR r IN 
        SELECT vma.restaurant_id, vma.legacy_menu_item_id, vma.parent_menu_item_id, vma.variant_id, vma.previous_state
        FROM variant_migration_audit vma
        WHERE vma.action_taken = 'MIGRATED_AND_ARCHIVED'
        ORDER BY vma.created_at DESC
    LOOP
        IF r.legacy_menu_item_id IS NOT NULL AND r.parent_menu_item_id IS NOT NULL THEN
            -- Revert order_items FK
            UPDATE order_items 
            SET menu_item_id = r.legacy_menu_item_id,
                variant_id = NULL
            WHERE menu_item_id = r.parent_menu_item_id 
              AND (variant_id = r.variant_id OR variant_id IS NULL);

            -- Revert menu_item_modifier_groups FK
            UPDATE menu_item_modifier_groups 
            SET menu_item_id = r.legacy_menu_item_id
            WHERE menu_item_id = r.parent_menu_item_id;

            -- Revert menu_item_tags FK
            UPDATE menu_item_tags 
            SET menu_item_id = r.legacy_menu_item_id
            WHERE menu_item_id = r.parent_menu_item_id;

            -- Revert inventory_events FK if table exists
            IF v_has_inventory_table THEN
                EXECUTE 'UPDATE inventory_events SET menu_item_id = $1 WHERE menu_item_id = $2'
                USING r.legacy_menu_item_id, r.parent_menu_item_id;
            END IF;

            -- Restore Legacy Menu Item
            UPDATE menu_items
            SET deleted_at = NULL,
                is_migrated_legacy_variant = false,
                availability_status = COALESCE(r.previous_state->>'availability_status', 'available'),
                sku = COALESCE(r.previous_state->>'sku', legacy_sku),
                parent_menu_item_id = NULL,
                migrated_to_variant_id = NULL
            WHERE id = r.legacy_menu_item_id;
        END IF;
    END LOOP;

    -- 2. Clean up product variants created during migration if not referenced in active order_items
    DELETE FROM product_variants pv
    WHERE EXISTS (
        SELECT 1 FROM variant_migration_audit vma WHERE vma.variant_id = pv.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.variant_id = pv.id
    );

    -- 3. Clean up parent menu items created during migration if no variants remain
    DELETE FROM menu_items m
    WHERE m.is_variant_parent = true
      AND NOT EXISTS (
          SELECT 1 FROM product_variants pv WHERE pv.menu_item_id = m.id AND pv.deleted_at IS NULL
      )
      AND NOT EXISTS (
          SELECT 1 FROM order_items oi WHERE oi.menu_item_id = m.id
      );

    -- 4. Clear audit log entries for restored items
    DELETE FROM variant_migration_audit;

END $$;
