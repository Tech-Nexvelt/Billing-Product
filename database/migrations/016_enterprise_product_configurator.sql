-- Migration 016: Enterprise Product Configurator Master Schema

-- 1. Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK(char_length(trim(name)) >= 1),
    sku TEXT,
    barcode TEXT,
    price_override NUMERIC(10,2),
    cost_price NUMERIC(10,2),
    stock_quantity NUMERIC(10,2) DEFAULT 0,
    prep_time_override INTEGER,
    kitchen_station_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

-- 2. Modifier Groups Table
CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK(char_length(trim(name)) >= 1),
    description TEXT,
    selection_type TEXT NOT NULL CHECK (
        selection_type IN ('single', 'multi', 'dropdown', 'quantity', 'text', 'textarea', 'number', 'toggle', 'color', 'date', 'time', 'slider', 'rating')
    ),
    is_required BOOLEAN NOT NULL DEFAULT false,
    min_selections INTEGER NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
    max_selections INTEGER DEFAULT 1 CHECK (max_selections IS NULL OR max_selections >= min_selections),
    is_template BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

-- 3. Modifier Options Table
CREATE TABLE IF NOT EXISTS modifier_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK(char_length(trim(name)) >= 1),
    price_type TEXT NOT NULL DEFAULT 'delta' CHECK (price_type IN ('fixed', 'delta', 'percentage', 'free', 'market')),
    price_delta NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT false,
    max_quantity INTEGER DEFAULT 10,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 4. Menu Item Modifier Groups Junction Table
CREATE TABLE IF NOT EXISTS menu_item_modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(menu_item_id, modifier_group_id)
);

-- 5. Modifier Conditional Dependencies Table
CREATE TABLE IF NOT EXISTS modifier_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    target_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    target_option_id UUID REFERENCES modifier_options(id) ON DELETE CASCADE,
    depends_on_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    depends_on_option_id UUID REFERENCES modifier_options(id) ON DELETE CASCADE,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('equals', 'not_equals', 'greater_than', 'contains')),
    action TEXT NOT NULL CHECK (action IN ('show', 'hide', 'enable', 'disable', 'require', 'auto_select', 'reset')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Inventory Deduction Recipes (Variants & Modifiers)
CREATE TABLE IF NOT EXISTS variant_inventory_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL,
    quantity_deducted NUMERIC(10,3) NOT NULL,
    unit_of_measure TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modifier_inventory_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    modifier_option_id UUID NOT NULL REFERENCES modifier_options(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL,
    quantity_deducted NUMERIC(10,3) NOT NULL,
    unit_of_measure TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Update order_items table for persisted JSONB configuration and hashing
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS configuration_hash TEXT;

-- High-Performance Multi-Tenant Indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_item ON product_variants(menu_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_modifier_groups_rest ON modifier_groups(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON modifier_options(group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_item_mod_junction ON menu_item_modifier_groups(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_hash ON order_items(configuration_hash);

-- Enable Multi-Tenant Row Level Security (RLS)
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_inventory_recipes ENABLE ROW LEVEL SECURITY;

-- Strict Tenant Isolation Policies
CREATE POLICY "Tenant Isolation: product_variants" ON product_variants FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);
CREATE POLICY "Tenant Isolation: modifier_groups" ON modifier_groups FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);
CREATE POLICY "Tenant Isolation: modifier_options" ON modifier_options FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);
CREATE POLICY "Tenant Isolation: menu_item_modifier_groups" ON menu_item_modifier_groups FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);
CREATE POLICY "Tenant Isolation: modifier_dependencies" ON modifier_dependencies FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);
CREATE POLICY "Tenant Isolation: variant_inventory_recipes" ON variant_inventory_recipes FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);
CREATE POLICY "Tenant Isolation: modifier_inventory_recipes" ON modifier_inventory_recipes FOR ALL USING (restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid);
