DO $$
DECLARE
    v_rest_id UUID;

    -- Category IDs provided
    v_veg_pizza_cat UUID := 'd5019ff1-4270-4d4b-a774-4a39f9bd5487';
    v_non_veg_pizza_cat UUID := 'a098802c-57c1-4a6e-b0be-6daa5f1c1ef9';
    v_veg_starters_cat UUID := '630533e8-9c7e-4a26-a166-03d6d1fe01cf';

    -- Global & Category Template Records
    rec_global_tmpl menu_items%ROWTYPE;
    rec_starter_tmpl menu_items%ROWTYPE;
    rec_veg_pizza_tmpl menu_items%ROWTYPE;
    rec_non_veg_pizza_tmpl menu_items%ROWTYPE;

    rec_child_6_tmpl menu_items%ROWTYPE;
    rec_child_8_tmpl menu_items%ROWTYPE;
    rec_child_10_tmpl menu_items%ROWTYPE;

    rec_variant_6_tmpl product_variants%ROWTYPE;
    rec_variant_8_tmpl product_variants%ROWTYPE;
    rec_variant_10_tmpl product_variants%ROWTYPE;

    -- Working records for mutation & insertion
    r_item menu_items%ROWTYPE;
    r_var product_variants%ROWTYPE;

    -- Sequences & Counters
    v_vp_seq INT;
    v_nvp_seq INT;
    v_vs_seq INT;
    v_display_order INT;

    -- Working variables
    v_parent_id UUID;
    v_sku_parent TEXT;
    v_sku_6 TEXT;
    v_sku_8 TEXT;
    v_sku_10 TEXT;
    v_var_sku_6 TEXT;
    v_var_sku_8 TEXT;
    v_var_sku_10 TEXT;
BEGIN
    FOR v_rest_id IN SELECT id FROM restaurants LOOP

        -- Fallback category IDs if category ID belongs to another instance
        IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_veg_pizza_cat AND restaurant_id = v_rest_id) THEN
            SELECT id INTO v_veg_pizza_cat FROM categories WHERE restaurant_id = v_rest_id AND LOWER(name) = 'veg pizza' AND deleted_at IS NULL LIMIT 1;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_non_veg_pizza_cat AND restaurant_id = v_rest_id) THEN
            SELECT id INTO v_non_veg_pizza_cat FROM categories WHERE restaurant_id = v_rest_id AND LOWER(name) = 'non veg pizza' AND deleted_at IS NULL LIMIT 1;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM categories WHERE id = v_veg_starters_cat AND restaurant_id = v_rest_id) THEN
            SELECT id INTO v_veg_starters_cat FROM categories WHERE restaurant_id = v_rest_id AND LOWER(name) = 'veg starters' AND deleted_at IS NULL LIMIT 1;
        END IF;

        -- Global fallback template row from menu_items for this restaurant
        SELECT * INTO rec_global_tmpl FROM menu_items WHERE restaurant_id = v_rest_id AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;

        -- Category-specific template rows
        SELECT * INTO rec_starter_tmpl FROM menu_items WHERE restaurant_id = v_rest_id AND category_id = v_veg_starters_cat AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;
        IF rec_starter_tmpl.id IS NULL THEN rec_starter_tmpl := rec_global_tmpl; END IF;

        SELECT * INTO rec_veg_pizza_tmpl FROM menu_items WHERE restaurant_id = v_rest_id AND category_id = v_veg_pizza_cat AND is_variant_parent = true AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;
        IF rec_veg_pizza_tmpl.id IS NULL THEN rec_veg_pizza_tmpl := rec_global_tmpl; END IF;

        SELECT * INTO rec_non_veg_pizza_tmpl FROM menu_items WHERE restaurant_id = v_rest_id AND category_id = v_non_veg_pizza_cat AND is_variant_parent = true AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;
        IF rec_non_veg_pizza_tmpl.id IS NULL THEN rec_non_veg_pizza_tmpl := rec_global_tmpl; END IF;

        -- Child size templates
        IF rec_veg_pizza_tmpl.id IS NOT NULL THEN
            SELECT * INTO rec_child_6_tmpl FROM menu_items WHERE parent_menu_item_id = rec_veg_pizza_tmpl.id AND name LIKE '%6"%' AND deleted_at IS NULL LIMIT 1;
            SELECT * INTO rec_child_8_tmpl FROM menu_items WHERE parent_menu_item_id = rec_veg_pizza_tmpl.id AND name LIKE '%8"%' AND deleted_at IS NULL LIMIT 1;
            SELECT * INTO rec_child_10_tmpl FROM menu_items WHERE parent_menu_item_id = rec_veg_pizza_tmpl.id AND name LIKE '%10"%' AND deleted_at IS NULL LIMIT 1;

            SELECT * INTO rec_variant_6_tmpl FROM product_variants WHERE menu_item_id = rec_veg_pizza_tmpl.id AND name LIKE '%6"%' AND deleted_at IS NULL LIMIT 1;
            SELECT * INTO rec_variant_8_tmpl FROM product_variants WHERE menu_item_id = rec_veg_pizza_tmpl.id AND name LIKE '%8"%' AND deleted_at IS NULL LIMIT 1;
            SELECT * INTO rec_variant_10_tmpl FROM product_variants WHERE menu_item_id = rec_veg_pizza_tmpl.id AND name LIKE '%10"%' AND deleted_at IS NULL LIMIT 1;
        END IF;

        IF rec_child_6_tmpl.id IS NULL THEN rec_child_6_tmpl := rec_veg_pizza_tmpl; END IF;
        IF rec_child_8_tmpl.id IS NULL THEN rec_child_8_tmpl := rec_veg_pizza_tmpl; END IF;
        IF rec_child_10_tmpl.id IS NULL THEN rec_child_10_tmpl := rec_veg_pizza_tmpl; END IF;

        -- SKU Sequence Calculators
        SELECT COALESCE(MAX(NULLIF(regexp_replace(sku, '\D', '', 'g'), '')::INT), 0) + 1 INTO v_vp_seq
        FROM (SELECT sku FROM menu_items WHERE restaurant_id = v_rest_id AND sku LIKE 'VP%' UNION SELECT sku FROM product_variants WHERE restaurant_id = v_rest_id AND sku LIKE 'VP%') s;

        SELECT COALESCE(MAX(NULLIF(regexp_replace(sku, '\D', '', 'g'), '')::INT), 0) + 1 INTO v_nvp_seq
        FROM (SELECT sku FROM menu_items WHERE restaurant_id = v_rest_id AND sku LIKE 'NVP%' UNION SELECT sku FROM product_variants WHERE restaurant_id = v_rest_id AND sku LIKE 'NVP%') s;

        SELECT COALESCE(MAX(NULLIF(regexp_replace(sku, '\D', '', 'g'), '')::INT), 0) + 1 INTO v_vs_seq
        FROM (SELECT sku FROM menu_items WHERE restaurant_id = v_rest_id AND sku LIKE 'VS%' UNION SELECT sku FROM product_variants WHERE restaurant_id = v_rest_id AND sku LIKE 'VS%') s;

        SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_display_order FROM menu_items WHERE restaurant_id = v_rest_id;

        -- =========================================================================
        -- ITEM 1: Veg Cheese Balls (Category: Veg Starters, Price: ₹220)
        -- =========================================================================
        IF v_veg_starters_cat IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id = v_rest_id AND LOWER(name) = LOWER('Veg Cheese Balls') AND deleted_at IS NULL) THEN
                v_sku_parent := 'VS' || LPAD(v_vs_seq::TEXT, 3, '0'); v_vs_seq := v_vs_seq + 1;

                r_item := rec_starter_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_starters_cat;
                r_item.name := 'Veg Cheese Balls';
                r_item.description := 'Veg Cheese Balls (8 Pieces)';
                r_item.cost_price := 0.00;
                r_item.selling_price := 220.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_parent;
                r_item.display_order := v_display_order; v_display_order := v_display_order + 1;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := NULL;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 15);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Veg Cheese Balls');
                r_item.deleted_at := NULL;
                r_item.deleted_by := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();

                INSERT INTO menu_items VALUES (r_item.*);
            END IF;
        END IF;

        -- =========================================================================
        -- ITEM 2: Paneer Tikka Pizza (Veg Pizza: 6" ₹180, 8" ₹220, 10" ₹260)
        -- =========================================================================
        IF v_veg_pizza_cat IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id = v_rest_id AND LOWER(name) = LOWER('Paneer Tikka Pizza') AND is_variant_parent = true AND deleted_at IS NULL) THEN
                v_sku_parent := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_var_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_parent_id := gen_random_uuid();

                -- Clone Parent
                r_item := rec_veg_pizza_tmpl;
                r_item.id := v_parent_id;
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Paneer Tikka Pizza';
                r_item.description := 'Paneer Tikka Pizza with rich toppings';
                r_item.cost_price := 0.00;
                r_item.selling_price := 180.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_parent;
                r_item.display_order := v_display_order; v_display_order := v_display_order + 1;
                r_item.is_variant_parent := true;
                r_item.parent_menu_item_id := NULL;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Paneer Tikka Pizza');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 6"
                r_item := rec_child_6_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Paneer Tikka Pizza (6")';
                r_item.description := 'Paneer Tikka Pizza (6")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 180.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_6;
                r_item.display_order := 1;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Paneer Tikka Pizza (6")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 8"
                r_item := rec_child_8_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Paneer Tikka Pizza (8")';
                r_item.description := 'Paneer Tikka Pizza (8")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 220.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_8;
                r_item.display_order := 2;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Paneer Tikka Pizza (8")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 10"
                r_item := rec_child_10_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Paneer Tikka Pizza (10")';
                r_item.description := 'Paneer Tikka Pizza (10")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 260.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_10;
                r_item.display_order := 3;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Paneer Tikka Pizza (10")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Product Variants
                IF rec_variant_6_tmpl.id IS NOT NULL THEN r_var := rec_variant_6_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '6"';
                r_var.sku := v_var_sku_6;
                r_var.price_override := 180.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 1;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_8_tmpl.id IS NOT NULL THEN r_var := rec_variant_8_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '8"';
                r_var.sku := v_var_sku_8;
                r_var.price_override := 220.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 2;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_10_tmpl.id IS NOT NULL THEN r_var := rec_variant_10_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '10"';
                r_var.sku := v_var_sku_10;
                r_var.price_override := 260.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 3;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);
            END IF;
        END IF;

        -- =========================================================================
        -- ITEM 3: Margherita Pizza (Veg Pizza: 6" ₹140, 8" ₹180, 10" ₹200)
        -- =========================================================================
        IF v_veg_pizza_cat IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id = v_rest_id AND LOWER(name) = LOWER('Margherita Pizza') AND is_variant_parent = true AND deleted_at IS NULL) THEN
                v_sku_parent := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_var_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_parent_id := gen_random_uuid();

                -- Clone Parent
                r_item := rec_veg_pizza_tmpl;
                r_item.id := v_parent_id;
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Margherita Pizza';
                r_item.description := 'Classic Margherita Pizza with cheese & basil';
                r_item.cost_price := 0.00;
                r_item.selling_price := 140.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_parent;
                r_item.display_order := v_display_order; v_display_order := v_display_order + 1;
                r_item.is_variant_parent := true;
                r_item.parent_menu_item_id := NULL;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Margherita Pizza');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 6"
                r_item := rec_child_6_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Margherita Pizza (6")';
                r_item.description := 'Margherita Pizza (6")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 140.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_6;
                r_item.display_order := 1;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Margherita Pizza (6")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 8"
                r_item := rec_child_8_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Margherita Pizza (8")';
                r_item.description := 'Margherita Pizza (8")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 180.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_8;
                r_item.display_order := 2;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Margherita Pizza (8")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 10"
                r_item := rec_child_10_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Margherita Pizza (10")';
                r_item.description := 'Margherita Pizza (10")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 200.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_10;
                r_item.display_order := 3;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Margherita Pizza (10")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Product Variants
                IF rec_variant_6_tmpl.id IS NOT NULL THEN r_var := rec_variant_6_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '6"';
                r_var.sku := v_var_sku_6;
                r_var.price_override := 140.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 1;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_8_tmpl.id IS NOT NULL THEN r_var := rec_variant_8_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '8"';
                r_var.sku := v_var_sku_8;
                r_var.price_override := 180.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 2;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_10_tmpl.id IS NOT NULL THEN r_var := rec_variant_10_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '10"';
                r_var.sku := v_var_sku_10;
                r_var.price_override := 200.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 3;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);
            END IF;
        END IF;

        -- =========================================================================
        -- ITEM 4: Mushroom Pizza (Veg Pizza: 6" ₹180, 8" ₹200, 10" ₹260)
        -- =========================================================================
        IF v_veg_pizza_cat IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id = v_rest_id AND LOWER(name) = LOWER('Mushroom Pizza') AND is_variant_parent = true AND deleted_at IS NULL) THEN
                v_sku_parent := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_var_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_parent_id := gen_random_uuid();

                -- Clone Parent
                r_item := rec_veg_pizza_tmpl;
                r_item.id := v_parent_id;
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Mushroom Pizza';
                r_item.description := 'Fresh Mushroom Pizza with mozzarella';
                r_item.cost_price := 0.00;
                r_item.selling_price := 180.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_parent;
                r_item.display_order := v_display_order; v_display_order := v_display_order + 1;
                r_item.is_variant_parent := true;
                r_item.parent_menu_item_id := NULL;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Mushroom Pizza');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 6"
                r_item := rec_child_6_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Mushroom Pizza (6")';
                r_item.description := 'Mushroom Pizza (6")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 180.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_6;
                r_item.display_order := 1;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Mushroom Pizza (6")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 8"
                r_item := rec_child_8_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Mushroom Pizza (8")';
                r_item.description := 'Mushroom Pizza (8")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 200.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_8;
                r_item.display_order := 2;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Mushroom Pizza (8")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 10"
                r_item := rec_child_10_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Mushroom Pizza (10")';
                r_item.description := 'Mushroom Pizza (10")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 260.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_10;
                r_item.display_order := 3;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Mushroom Pizza (10")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Product Variants
                IF rec_variant_6_tmpl.id IS NOT NULL THEN r_var := rec_variant_6_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '6"';
                r_var.sku := v_var_sku_6;
                r_var.price_override := 180.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 1;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_8_tmpl.id IS NOT NULL THEN r_var := rec_variant_8_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '8"';
                r_var.sku := v_var_sku_8;
                r_var.price_override := 200.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 2;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_10_tmpl.id IS NOT NULL THEN r_var := rec_variant_10_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '10"';
                r_var.sku := v_var_sku_10;
                r_var.price_override := 260.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 3;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);
            END IF;
        END IF;

        -- =========================================================================
        -- ITEM 5: Veg Paprika Pizza (Veg Pizza: 6" ₹180, 8" ₹200, 10" ₹240)
        -- =========================================================================
        IF v_veg_pizza_cat IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id = v_rest_id AND LOWER(name) = LOWER('Veg Paprika Pizza') AND is_variant_parent = true AND deleted_at IS NULL) THEN
                v_sku_parent := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_var_sku_6 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_8 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;
                v_var_sku_10 := 'VP' || LPAD(v_vp_seq::TEXT, 3, '0'); v_vp_seq := v_vp_seq + 1;

                v_parent_id := gen_random_uuid();

                -- Clone Parent
                r_item := rec_veg_pizza_tmpl;
                r_item.id := v_parent_id;
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Veg Paprika Pizza';
                r_item.description := 'Spicy Veg Paprika Pizza with red paprika';
                r_item.cost_price := 0.00;
                r_item.selling_price := 180.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_parent;
                r_item.display_order := v_display_order; v_display_order := v_display_order + 1;
                r_item.is_variant_parent := true;
                r_item.parent_menu_item_id := NULL;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Veg Paprika Pizza');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 6"
                r_item := rec_child_6_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Veg Paprika Pizza (6")';
                r_item.description := 'Veg Paprika Pizza (6")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 180.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_6;
                r_item.display_order := 1;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Veg Paprika Pizza (6")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 8"
                r_item := rec_child_8_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Veg Paprika Pizza (8")';
                r_item.description := 'Veg Paprika Pizza (8")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 200.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_8;
                r_item.display_order := 2;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Veg Paprika Pizza (8")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 10"
                r_item := rec_child_10_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_veg_pizza_cat;
                r_item.name := 'Veg Paprika Pizza (10")';
                r_item.description := 'Veg Paprika Pizza (10")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 240.00;
                r_item.is_veg := true;
                r_item.sku := v_sku_10;
                r_item.display_order := 3;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 20);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Veg Paprika Pizza (10")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Product Variants
                IF rec_variant_6_tmpl.id IS NOT NULL THEN r_var := rec_variant_6_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '6"';
                r_var.sku := v_var_sku_6;
                r_var.price_override := 180.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 1;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_8_tmpl.id IS NOT NULL THEN r_var := rec_variant_8_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '8"';
                r_var.sku := v_var_sku_8;
                r_var.price_override := 200.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 2;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_10_tmpl.id IS NOT NULL THEN r_var := rec_variant_10_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '10"';
                r_var.sku := v_var_sku_10;
                r_var.price_override := 240.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 3;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);
            END IF;
        END IF;

        -- =========================================================================
        -- ITEM 6: Prawns Chicken Pizza (Non Veg Pizza: 6" ₹260, 8" ₹300, 10" ₹380)
        -- =========================================================================
        IF v_non_veg_pizza_cat IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id = v_rest_id AND LOWER(name) = LOWER('Prawns Chicken Pizza') AND is_variant_parent = true AND deleted_at IS NULL) THEN
                v_sku_parent := 'NVP' || LPAD(v_nvp_seq::TEXT, 3, '0'); v_nvp_seq := v_nvp_seq + 1;
                v_sku_6 := 'NVP' || LPAD(v_nvp_seq::TEXT, 3, '0'); v_nvp_seq := v_nvp_seq + 1;
                v_sku_8 := 'NVP' || LPAD(v_nvp_seq::TEXT, 3, '0'); v_nvp_seq := v_nvp_seq + 1;
                v_sku_10 := 'NVP' || LPAD(v_nvp_seq::TEXT, 3, '0'); v_nvp_seq := v_nvp_seq + 1;

                v_var_sku_6 := 'NVP' || LPAD(v_nvp_seq::TEXT, 3, '0'); v_nvp_seq := v_nvp_seq + 1;
                v_var_sku_8 := 'NVP' || LPAD(v_nvp_seq::TEXT, 3, '0'); v_nvp_seq := v_nvp_seq + 1;
                v_var_sku_10 := 'NVP' || LPAD(v_nvp_seq::TEXT, 3, '0'); v_nvp_seq := v_nvp_seq + 1;

                v_parent_id := gen_random_uuid();

                -- Clone Parent
                r_item := rec_non_veg_pizza_tmpl;
                r_item.id := v_parent_id;
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_non_veg_pizza_cat;
                r_item.name := 'Prawns Chicken Pizza';
                r_item.description := 'Special Prawns & Chicken Pizza with seafood & poultry fusion';
                r_item.cost_price := 0.00;
                r_item.selling_price := 260.00;
                r_item.is_veg := false;
                r_item.sku := v_sku_parent;
                r_item.display_order := v_display_order; v_display_order := v_display_order + 1;
                r_item.is_variant_parent := true;
                r_item.parent_menu_item_id := NULL;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 25);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Prawns Chicken Pizza');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 6"
                r_item := rec_child_6_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_non_veg_pizza_cat;
                r_item.name := 'Prawns Chicken Pizza (6")';
                r_item.description := 'Prawns Chicken Pizza (6")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 260.00;
                r_item.is_veg := false;
                r_item.sku := v_sku_6;
                r_item.display_order := 1;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 25);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Prawns Chicken Pizza (6")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 8"
                r_item := rec_child_8_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_non_veg_pizza_cat;
                r_item.name := 'Prawns Chicken Pizza (8")';
                r_item.description := 'Prawns Chicken Pizza (8")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 300.00;
                r_item.is_veg := false;
                r_item.sku := v_sku_8;
                r_item.display_order := 2;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 25);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Prawns Chicken Pizza (8")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Clone Child 10"
                r_item := rec_child_10_tmpl;
                r_item.id := gen_random_uuid();
                r_item.restaurant_id := v_rest_id;
                r_item.category_id := v_non_veg_pizza_cat;
                r_item.name := 'Prawns Chicken Pizza (10")';
                r_item.description := 'Prawns Chicken Pizza (10")';
                r_item.cost_price := 0.00;
                r_item.selling_price := 380.00;
                r_item.is_veg := false;
                r_item.sku := v_sku_10;
                r_item.display_order := 3;
                r_item.is_variant_parent := false;
                r_item.parent_menu_item_id := v_parent_id;
                r_item.availability_status := COALESCE(r_item.availability_status, 'available');
                r_item.prep_time := COALESCE(r_item.prep_time, 25);
                r_item.version := COALESCE(r_item.version, 1);
                r_item.image_url := COALESCE(r_item.image_url, 'https://images.unsplash.com/photo-1513104890138-7c749659a591');
                r_item.image_medium_url := COALESCE(r_item.image_medium_url, r_item.image_url);
                r_item.thumbnail_url := COALESCE(r_item.thumbnail_url, r_item.image_url);
                r_item.image_hash := COALESCE(r_item.image_hash, 'default_hash');
                r_item.image_size := COALESCE(r_item.image_size, 1024);
                r_item.mime_type := COALESCE(r_item.mime_type, 'image/jpeg');
                r_item.image_alt := COALESCE(r_item.image_alt, 'Prawns Chicken Pizza (10")');
                r_item.deleted_at := NULL;
                r_item.created_at := NOW();
                r_item.updated_at := NOW();
                INSERT INTO menu_items VALUES (r_item.*);

                -- Product Variants
                IF rec_variant_6_tmpl.id IS NOT NULL THEN r_var := rec_variant_6_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '6"';
                r_var.sku := v_var_sku_6;
                r_var.price_override := 260.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 1;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_8_tmpl.id IS NOT NULL THEN r_var := rec_variant_8_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '8"';
                r_var.sku := v_var_sku_8;
                r_var.price_override := 300.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 2;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);

                IF rec_variant_10_tmpl.id IS NOT NULL THEN r_var := rec_variant_10_tmpl; ELSE r_var.is_active := true; END IF;
                r_var.id := gen_random_uuid();
                r_var.restaurant_id := v_rest_id;
                r_var.menu_item_id := v_parent_id;
                r_var.name := '10"';
                r_var.sku := v_var_sku_10;
                r_var.price_override := 380.00;
                r_var.cost_price := 0.00;
                r_var.is_active := true;
                r_var.display_order := 3;
                r_var.deleted_at := NULL;
                r_var.created_at := NOW();
                r_var.updated_at := NOW();
                INSERT INTO product_variants VALUES (r_var.*);
            END IF;
        END IF;

    END LOOP;
END $$;
