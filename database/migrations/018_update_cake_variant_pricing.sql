-- ============================================================================
-- MIGRATION 018: ENTERPRISE CAKE VARIANT PRICING FIX SCRIPT (COLLISION FREE)
-- Idempotent update for 17 Cake Parent Products and their ½ Kg & 1 Kg Variants.
-- ============================================================================

DO $$
DECLARE
    v_rest_id UUID;
    v_cat_id UUID;
    v_parent_id UUID;
    
    cakes_data JSONB := '[
        {"sku": "CK001", "name": "Chocolate Fudge", "half_price": 500.00, "one_price": 1000.00, "match": "Chocolate Fudge"},
        {"sku": "CK002", "name": "Choco Chip", "half_price": 500.00, "one_price": 1000.00, "match": "Choco Chip"},
        {"sku": "CK003", "name": "Choco Mousse", "half_price": 450.00, "one_price": 900.00, "match": "Choco Mousse"},
        {"sku": "CK004", "name": "Black Forest", "half_price": 450.00, "one_price": 900.00, "match": "Black Forest"},
        {"sku": "CK005", "name": "White Forest", "half_price": 450.00, "one_price": 900.00, "match": "White Forest"},
        {"sku": "CK006", "name": "Pineapple", "half_price": 300.00, "one_price": 600.00, "match": "Pineapple"},
        {"sku": "CK007", "name": "Vanilla", "half_price": 350.00, "one_price": 700.00, "match": "Vanilla"},
        {"sku": "CK008", "name": "Butterscotch", "half_price": 350.00, "one_price": 700.00, "match": "Butterscotch"},
        {"sku": "CK009", "name": "Rasmalai", "half_price": 600.00, "one_price": 1200.00, "match": "Rasmalai"},
        {"sku": "CK010", "name": "Honey Almond", "half_price": 600.00, "one_price": 1200.00, "match": "Honey Almond"},
        {"sku": "CK011", "name": "Chocolate Almond", "half_price": 600.00, "one_price": 1200.00, "match": "Chocolate Almond"},
        {"sku": "CK012", "name": "Pista", "half_price": 600.00, "one_price": 1200.00, "match": "Pista"},
        {"sku": "CK013", "name": "Rabdi", "half_price": 600.00, "one_price": 1200.00, "match": "Rabdi"},
        {"sku": "CK014", "name": "Fresh Fruit", "half_price": 650.00, "one_price": 1300.00, "match": "Fresh Fruit"},
        {"sku": "CK015", "name": "Belgium Chocolate", "half_price": 900.00, "one_price": 1800.00, "match": "Belgium Chocolate"},
        {"sku": "CK016", "name": "French Biscuit", "half_price": 1000.00, "one_price": 2000.00, "match": "French Biscuit"},
        {"sku": "CK017", "name": "Chocolate Caramel", "half_price": 900.00, "one_price": 1800.00, "match": "Chocolate Caramel"}
    ]';
    
    item JSONB;
    v_sku TEXT;
    v_name TEXT;
    v_match TEXT;
    v_half NUMERIC(10,2);
    v_one NUMERIC(10,2);
BEGIN
    FOR v_rest_id IN SELECT id FROM restaurants LOOP
        -- 1. Find or create the "Cakes" category for this restaurant
        SELECT id INTO v_cat_id 
        FROM categories 
        WHERE restaurant_id = v_rest_id 
          AND (LOWER(name) = 'cakes' OR LOWER(name) LIKE '%cake%') 
          AND deleted_at IS NULL 
        ORDER BY created_at ASC 
        LIMIT 1;

        IF v_cat_id IS NULL THEN
            INSERT INTO categories (restaurant_id, name, description, color, display_order, is_active)
            VALUES (v_rest_id, 'Cakes', 'Freshly baked artisanal cakes', '#EC4899', 15, true)
            RETURNING id INTO v_cat_id;
        ELSE
            UPDATE categories SET is_active = true, name = 'Cakes' WHERE id = v_cat_id;
        END IF;

        -- 2. Process each of the 17 cake items
        FOR item IN SELECT * FROM jsonb_array_elements(cakes_data) LOOP
            v_sku := item->>'sku';
            v_name := item->>'name';
            v_match := item->>'match';
            v_half := (item->>'half_price')::NUMERIC;
            v_one := (item->>'one_price')::NUMERIC;

            -- Find existing parent menu item by SKU, Exact Name, or Fuzzy Match
            SELECT id INTO v_parent_id 
            FROM menu_items 
            WHERE restaurant_id = v_rest_id 
              AND (
                sku = v_sku 
                OR LOWER(TRIM(name)) = LOWER(TRIM(v_name)) 
                OR LOWER(name) LIKE LOWER('%' || v_match || '%')
              )
              AND deleted_at IS NULL 
            ORDER BY (CASE WHEN sku = v_sku THEN 1 WHEN LOWER(TRIM(name)) = LOWER(TRIM(v_name)) THEN 2 ELSE 3 END), created_at ASC 
            LIMIT 1;

            -- Nullify SKU on any existing duplicate menu_items to avoid unique constraint collisions
            IF v_parent_id IS NOT NULL THEN
                UPDATE menu_items 
                SET sku = NULL 
                WHERE restaurant_id = v_rest_id 
                  AND sku = v_sku 
                  AND id != v_parent_id;
            ELSE
                UPDATE menu_items 
                SET sku = NULL 
                WHERE restaurant_id = v_rest_id 
                  AND sku = v_sku;
            END IF;

            IF v_parent_id IS NULL THEN
                INSERT INTO menu_items (
                    restaurant_id, category_id, name, description, cost_price, selling_price,
                    image_url, is_veg, prep_time, availability_status, sku, is_variant_parent, display_order
                ) VALUES (
                    v_rest_id, v_cat_id, v_name, 'Freshly baked artisanal cake', 
                    v_half * 0.4, v_half,
                    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800', 
                    true, 15, 'available', v_sku, true, 1
                )
                RETURNING id INTO v_parent_id;
            ELSE
                UPDATE menu_items 
                SET is_variant_parent = true,
                    sku = v_sku,
                    name = v_name,
                    category_id = v_cat_id,
                    selling_price = v_half,
                    availability_status = 'available',
                    updated_at = now()
                WHERE id = v_parent_id;
            END IF;

            -- 3. Upsert "½ Kg" Variant
            IF EXISTS (
                SELECT 1 FROM product_variants 
                WHERE restaurant_id = v_rest_id 
                  AND menu_item_id = v_parent_id 
                  AND (name IN ('½ Kg', '1/2 Kg', '0.5 Kg', '500g', '500 g'))
                  AND deleted_at IS NULL
            ) THEN
                UPDATE product_variants 
                SET name = '½ Kg',
                    price_override = v_half,
                    sku = v_sku || '-500G',
                    is_active = true,
                    updated_at = now()
                WHERE restaurant_id = v_rest_id 
                  AND menu_item_id = v_parent_id 
                  AND (name IN ('½ Kg', '1/2 Kg', '0.5 Kg', '500g', '500 g'))
                  AND deleted_at IS NULL;
            ELSE
                INSERT INTO product_variants (
                    restaurant_id, menu_item_id, name, price_override, cost_price, sku, display_order, is_active
                ) VALUES (
                    v_rest_id, v_parent_id, '½ Kg', v_half, v_half * 0.4, v_sku || '-500G', 1, true
                );
            END IF;

            -- 4. Upsert "1 Kg" Variant
            IF EXISTS (
                SELECT 1 FROM product_variants 
                WHERE restaurant_id = v_rest_id 
                  AND menu_item_id = v_parent_id 
                  AND (name IN ('1 Kg', '1Kg', '1 kg', '1000g'))
                  AND deleted_at IS NULL
            ) THEN
                UPDATE product_variants 
                SET name = '1 Kg',
                    price_override = v_one,
                    sku = v_sku || '-1KG',
                    is_active = true,
                    updated_at = now()
                WHERE restaurant_id = v_rest_id 
                  AND menu_item_id = v_parent_id 
                  AND (name IN ('1 Kg', '1Kg', '1 kg', '1000g'))
                  AND deleted_at IS NULL;
            ELSE
                INSERT INTO product_variants (
                    restaurant_id, menu_item_id, name, price_override, cost_price, sku, display_order, is_active
                ) VALUES (
                    v_rest_id, v_parent_id, '1 Kg', v_one, v_one * 0.4, v_sku || '-1KG', 2, true
                );
            END IF;

        END LOOP;
    END LOOP;
END $$;
