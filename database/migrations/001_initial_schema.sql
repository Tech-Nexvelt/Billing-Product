CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

CREATE TABLE business_types (slug TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE table_types (slug TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE availability_status (slug TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT);

INSERT INTO business_types VALUES ('restaurant','Restaurant'),('cafe','Café'),('bakery','Bakery'),('food_court','Food Court'),('cloud_kitchen','Cloud Kitchen'),('bar','Bar & Lounge');
INSERT INTO table_types VALUES ('dining','Dining'),('vip','VIP'),('outdoor','Outdoor'),('family','Family'),('private','Private');
INSERT INTO availability_status VALUES ('available','Available','#22C55E'),('out_of_stock','Out of Stock','#EF4444'),('hidden','Hidden','#9CA3AF'),('seasonal','Seasonal','#F59E0B');

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    name TEXT NOT NULL CHECK(char_length(trim(name))>=2), 
    slug TEXT NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]+$'), 
    is_active BOOLEAN NOT NULL DEFAULT true, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT, 
    restaurant_code TEXT NOT NULL UNIQUE, 
    name TEXT NOT NULL CHECK(char_length(trim(name))>=2), 
    logo_url TEXT, 
    phone TEXT CHECK(phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$'), 
    email TEXT CHECK(email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'), 
    address TEXT, 
    gst_number TEXT CHECK(gst_number IS NULL OR gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'), 
    currency TEXT NOT NULL DEFAULT 'INR', 
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', 
    business_type TEXT REFERENCES business_types(slug) ON DELETE SET NULL, 
    is_active BOOLEAN NOT NULL DEFAULT true, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE, 
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK(tax_rate>=0 AND tax_rate<=100), 
    service_charge NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK(service_charge>=0 AND service_charge<=100), 
    num_floors INTEGER NOT NULL DEFAULT 1 CHECK(num_floors>0), 
    num_tables INTEGER NOT NULL DEFAULT 1 CHECK(num_tables>0), 
    currency_symbol TEXT NOT NULL DEFAULT '₹', 
    decimal_places INTEGER NOT NULL DEFAULT 2 CHECK(decimal_places>=0 AND decimal_places<=4), 
    date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY', 
    time_format TEXT NOT NULL DEFAULT 'HH:mm', 
    language TEXT NOT NULL DEFAULT 'en', 
    version INTEGER NOT NULL DEFAULT 1, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, 
    role_id UUID, -- Foreign key defined later due to cyclic dependency or wait
    full_name TEXT NOT NULL CHECK(char_length(trim(full_name))>=2), 
    avatar_url TEXT, 
    phone TEXT CHECK(phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$'), 
    is_active BOOLEAN NOT NULL DEFAULT true, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, 
    name TEXT NOT NULL CHECK(char_length(trim(name))>=2), 
    description TEXT, 
    is_system BOOLEAN NOT NULL DEFAULT false, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    UNIQUE(restaurant_id, name)
);

ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE, 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, 
    module TEXT NOT NULL CHECK(module IN ('menu','tables','orders','floors','settings','roles','dashboard')), 
    can_view BOOLEAN NOT NULL DEFAULT false, 
    can_create BOOLEAN NOT NULL DEFAULT false, 
    can_update BOOLEAN NOT NULL DEFAULT false, 
    can_delete BOOLEAN NOT NULL DEFAULT false, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    UNIQUE(role_id, module)
);

CREATE TABLE floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, 
    name TEXT NOT NULL CHECK(char_length(trim(name))>=1), 
    display_order INTEGER NOT NULL DEFAULT 0, 
    is_active BOOLEAN NOT NULL DEFAULT true, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    UNIQUE(restaurant_id, name)
);

CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, 
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE RESTRICT, 
    table_number TEXT NOT NULL CHECK(char_length(trim(table_number))>=1), 
    capacity INTEGER NOT NULL CHECK(capacity>0 AND capacity<=100), 
    customer_count INTEGER DEFAULT NULL CHECK(customer_count IS NULL OR customer_count>=0), 
    current_bill NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(current_bill>=0), 
    table_type TEXT NOT NULL DEFAULT 'dining' REFERENCES table_types(slug), 
    table_shape TEXT NOT NULL DEFAULT 'square' CHECK(table_shape IN ('square','rectangle','circle')), 
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','occupied','reserved','cleaning','disabled')), 
    position_x NUMERIC(8,2) DEFAULT NULL, 
    position_y NUMERIC(8,2) DEFAULT NULL, 
    qr_code TEXT DEFAULT NULL, 
    qr_url TEXT DEFAULT NULL, 
    display_order INTEGER NOT NULL DEFAULT 0, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    UNIQUE(restaurant_id, floor_id, table_number)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, 
    name TEXT NOT NULL CHECK(char_length(trim(name))>=2), 
    description TEXT, 
    image_url TEXT, 
    icon TEXT, 
    color TEXT CHECK(color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'), 
    display_order INTEGER NOT NULL DEFAULT 0, 
    is_active BOOLEAN NOT NULL DEFAULT true, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    UNIQUE(restaurant_id, name)
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE, 
    slug TEXT NOT NULL CHECK(slug ~ '^[a-z0-9_]+$'), 
    label TEXT NOT NULL CHECK(char_length(trim(label))>=1), 
    color TEXT CHECK(color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'), 
    is_system BOOLEAN NOT NULL DEFAULT false, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    UNIQUE(restaurant_id, slug)
);

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, 
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, 
    name TEXT NOT NULL CHECK(char_length(trim(name))>=2), 
    description TEXT, 
    cost_price NUMERIC(10,2) CHECK(cost_price IS NULL OR cost_price>=0), 
    selling_price NUMERIC(10,2) NOT NULL CHECK(selling_price>=0), 
    image_url TEXT NOT NULL, 
    image_medium_url TEXT, 
    thumbnail_url TEXT, 
    image_hash TEXT, 
    image_size INTEGER CHECK(image_size IS NULL OR (image_size>0 AND image_size<=5242880)), 
    mime_type TEXT CHECK(mime_type IS NULL OR mime_type IN ('image/jpeg','image/png','image/webp')), 
    image_alt TEXT, 
    is_veg BOOLEAN NOT NULL DEFAULT false, 
    prep_time INTEGER CHECK(prep_time IS NULL OR prep_time>0), 
    availability_status TEXT NOT NULL DEFAULT 'available' REFERENCES availability_status(slug), 
    sku TEXT, 
    barcode TEXT, 
    display_order INTEGER NOT NULL DEFAULT 0, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_item_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE, 
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE, 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    UNIQUE(menu_item_id, tag_id)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, 
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE RESTRICT, 
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE RESTRICT, 
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','preparing','completed','cancelled')), 
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0), 
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0), 
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0), 
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(grand_total>=0), 
    special_instructions TEXT, 
    kitchen_notes TEXT, 
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, 
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, 
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL, 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, 
    item_name TEXT NOT NULL CHECK(char_length(trim(item_name))>=1), 
    category_name TEXT, 
    unit_price NUMERIC(10,2) NOT NULL CHECK(unit_price>=0), 
    quantity INTEGER NOT NULL CHECK(quantity>0), 
    item_total NUMERIC(12,2) NOT NULL CHECK(item_total>=0), 
    special_notes TEXT, 
    version INTEGER NOT NULL DEFAULT 1, 
    deleted_at TIMESTAMPTZ, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, 
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, 
    action TEXT NOT NULL, 
    resource_type TEXT NOT NULL, 
    resource_id UUID, 
    ip_address INET, 
    browser TEXT, 
    device TEXT, 
    metadata JSONB DEFAULT '{}', 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, 
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, 
    table_name TEXT NOT NULL, 
    record_id UUID NOT NULL, 
    action TEXT NOT NULL CHECK(action IN ('INSERT','UPDATE','DELETE')), 
    before_data JSONB, 
    after_data JSONB, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_menu_items_sku_unique ON menu_items(restaurant_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_menu_items_barcode_unique ON menu_items(restaurant_id, barcode) WHERE barcode IS NOT NULL AND deleted_at IS NULL;

-- organizations
CREATE INDEX idx_restaurants_org ON restaurants(organization_id) WHERE deleted_at IS NULL;
-- users
CREATE INDEX idx_users_restaurant ON users(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role_id) WHERE deleted_at IS NULL;
-- roles/permissions
CREATE INDEX idx_roles_restaurant ON roles(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_permissions_role ON permissions(role_id);
CREATE INDEX idx_permissions_restaurant ON permissions(restaurant_id);
-- floors
CREATE INDEX idx_floors_restaurant ON floors(restaurant_id, display_order) WHERE deleted_at IS NULL;
-- tables
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tables_floor ON tables(floor_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_tables_status ON tables(restaurant_id, status) WHERE deleted_at IS NULL;
-- categories
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id, display_order) WHERE deleted_at IS NULL;
-- menu_items
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_items_category ON menu_items(category_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_items_status ON menu_items(restaurant_id, availability_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_items_name_fts ON menu_items USING gin(to_tsvector('english', name));
CREATE INDEX idx_menu_items_desc_fts ON menu_items USING gin(to_tsvector('english', coalesce(description,'')));
-- menu_item_tags
CREATE INDEX idx_menu_item_tags_item ON menu_item_tags(menu_item_id);
CREATE INDEX idx_menu_item_tags_tag ON menu_item_tags(tag_id);
-- orders
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_table ON orders(table_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders(restaurant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_created ON orders(restaurant_id, created_at DESC) WHERE deleted_at IS NULL;
-- order_items
CREATE INDEX idx_order_items_order ON order_items(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_order_items_item ON order_items(menu_item_id) WHERE deleted_at IS NULL;
-- logs
CREATE INDEX idx_activity_logs_restaurant ON activity_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_audit_logs_restaurant ON audit_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_audit_logs_record ON audit_logs(table_name, record_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_restaurant_code()
RETURNS TRIGGER AS $$
DECLARE
  seq_num INTEGER;
  new_code TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('restaurant_code_seq'));
  SELECT COUNT(*) + 1 INTO seq_num FROM restaurants;
  new_code := 'NXV-' || LPAD(seq_num::TEXT, 4, '0');
  NEW.restaurant_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_current_bill()
RETURNS TRIGGER AS $$
DECLARE
  v_table_id UUID;
  v_total NUMERIC;
BEGIN
  SELECT table_id INTO v_table_id
  FROM orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id)
    AND status IN ('draft','pending');
  
  IF v_table_id IS NOT NULL THEN
    SELECT COALESCE(SUM(oi.item_total), 0) INTO v_total
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.table_id = v_table_id
      AND o.status IN ('draft','pending')
      AND oi.deleted_at IS NULL;
    
    UPDATE tables SET current_bill = v_total, updated_at = now() WHERE id = v_table_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs(restaurant_id, user_id, table_name, record_id, action, before_data, after_data)
  VALUES (
    COALESCE(NEW.restaurant_id, OLD.restaurant_id),
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert if restaurant_id metadata is present
  IF NEW.raw_user_meta_data->>'restaurant_id' IS NOT NULL THEN
    INSERT INTO users(id, restaurant_id, role_id, full_name, avatar_url)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'restaurant_id')::UUID,
      (NEW.raw_user_meta_data->>'role_id')::UUID,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.raw_user_meta_data->>'avatar_url'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_restaurant_workspace(
  p_restaurant_id UUID,
  p_num_floors INTEGER DEFAULT 1,
  p_num_tables INTEGER DEFAULT 10
)
RETURNS void AS $$
DECLARE
  v_owner_role_id UUID;
  v_manager_role_id UUID;
  v_cashier_role_id UUID;
  v_kitchen_role_id UUID;
  v_floor_id UUID;
  i INTEGER;
BEGIN
  -- Create 4 default roles
  INSERT INTO roles(restaurant_id, name, description, is_system)
  VALUES
    (p_restaurant_id, 'Owner', 'Full access to all modules', true),
    (p_restaurant_id, 'Manager', 'Manage operations, menu and staff', true),
    (p_restaurant_id, 'Cashier', 'Process orders and payments', true),
    (p_restaurant_id, 'Kitchen', 'View and update kitchen orders', true);

  
  SELECT id INTO v_owner_role_id FROM roles WHERE restaurant_id = p_restaurant_id AND name = 'Owner';
  SELECT id INTO v_manager_role_id FROM roles WHERE restaurant_id = p_restaurant_id AND name = 'Manager';
  SELECT id INTO v_cashier_role_id FROM roles WHERE restaurant_id = p_restaurant_id AND name = 'Cashier';
  SELECT id INTO v_kitchen_role_id FROM roles WHERE restaurant_id = p_restaurant_id AND name = 'Kitchen';
  
  -- Owner: full access to all modules
  INSERT INTO permissions(role_id, restaurant_id, module, can_view, can_create, can_update, can_delete)
  SELECT v_owner_role_id, p_restaurant_id, m, true, true, true, true
  FROM unnest(ARRAY['menu','tables','orders','floors','settings','roles','dashboard']) AS m;
  
  -- Manager: full except settings/roles delete
  INSERT INTO permissions(role_id, restaurant_id, module, can_view, can_create, can_update, can_delete)
  SELECT v_manager_role_id, p_restaurant_id, m,
    true, true, true,
    CASE WHEN m IN ('settings','roles') THEN false ELSE true END
  FROM unnest(ARRAY['menu','tables','orders','floors','settings','roles','dashboard']) AS m;
  
  -- Cashier: view+create+update orders and tables, view menu and dashboard
  INSERT INTO permissions(role_id, restaurant_id, module, can_view, can_create, can_update, can_delete)
  VALUES
    (v_cashier_role_id, p_restaurant_id, 'orders', true, true, true, false),
    (v_cashier_role_id, p_restaurant_id, 'tables', true, false, true, false),
    (v_cashier_role_id, p_restaurant_id, 'menu', true, false, false, false),
    (v_cashier_role_id, p_restaurant_id, 'dashboard', true, false, false, false);
  
  -- Kitchen: view orders only
  INSERT INTO permissions(role_id, restaurant_id, module, can_view, can_create, can_update, can_delete)
  VALUES
    (v_kitchen_role_id, p_restaurant_id, 'orders', true, false, true, false),
    (v_kitchen_role_id, p_restaurant_id, 'dashboard', true, false, false, false);
  
  -- Create restaurant settings
  INSERT INTO restaurant_settings(restaurant_id, num_floors, num_tables)
  VALUES (p_restaurant_id, p_num_floors, p_num_tables)
  ON CONFLICT (restaurant_id) DO NOTHING;
  
  -- Create default system tags
  INSERT INTO tags(slug, label, color, is_system) VALUES
    ('popular','Popular','#F59E0B', true),
    ('chef_special','Chef Special','#0AB190', true),
    ('spicy','Spicy','#EF4444', true),
    ('kids','Kids','#3B82F6', true),
    ('vegan','Vegan','#22C55E', true),
    ('recommended','Recommended','#8B5CF6', true),
    ('best_seller','Best Seller','#F97316', true),
    ('gluten_free','Gluten Free','#EC4899', true)
  ON CONFLICT DO NOTHING;
  
  -- Create floors
  FOR i IN 1..p_num_floors LOOP
    INSERT INTO floors(restaurant_id, name, display_order)
    VALUES (
      p_restaurant_id,
      CASE i WHEN 1 THEN 'Ground Floor' WHEN 2 THEN 'First Floor' WHEN 3 THEN 'Second Floor'
              ELSE 'Floor ' || i END,
      i
    ) RETURNING id INTO v_floor_id;
    
    -- Create tables for this floor
    FOR j IN 1..CEIL(p_num_tables::NUMERIC / p_num_floors) LOOP
      INSERT INTO tables(restaurant_id, floor_id, table_number, capacity, display_order)
      VALUES (
        p_restaurant_id,
        v_floor_id,
        'T' || ((i-1) * CEIL(p_num_tables::NUMERIC / p_num_floors) + j)::TEXT,
        4,
        j
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_updated_at_organizations BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_restaurants BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_restaurant_settings BEFORE UPDATE ON restaurant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_roles BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_permissions BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_floors BEFORE UPDATE ON floors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_tables BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_categories BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_menu_items BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_order_items BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_generate_restaurant_code BEFORE INSERT ON restaurants FOR EACH ROW EXECUTE FUNCTION generate_restaurant_code();
CREATE TRIGGER trg_update_current_bill AFTER INSERT OR UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION update_current_bill();
CREATE TRIGGER trg_handle_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER trg_audit_menu_items AFTER UPDATE OR DELETE ON menu_items FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_orders AFTER UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_tables AFTER UPDATE OR DELETE ON tables FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER trg_audit_categories AFTER UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON restaurants FOR SELECT USING (id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON restaurants FOR INSERT WITH CHECK (id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON restaurants FOR UPDATE USING (id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON restaurant_settings FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_insert" ON restaurant_settings FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON restaurant_settings FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON users FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON users FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON users FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON roles FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON roles FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON roles FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON permissions FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_insert" ON permissions FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON permissions FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON floors FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON floors FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON floors FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON tables FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON tables FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON tables FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON categories FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON categories FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON categories FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tags_select" ON tags FOR SELECT USING (restaurant_id IS NULL OR restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_insert" ON tags FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON tags FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON menu_items FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON menu_items FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON menu_items FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON menu_item_tags FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_insert" ON menu_item_tags FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON menu_item_tags FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON orders FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON orders FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON orders FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON order_items FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "tenant_insert" ON order_items FOR INSERT WITH CHECK (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_update" ON order_items FOR UPDATE USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

CREATE POLICY "tenant_select" ON activity_logs FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);
CREATE POLICY "tenant_select" ON audit_logs FOR SELECT USING (restaurant_id = (auth.jwt() ->> 'restaurant_id')::uuid);

-- Migration complete
