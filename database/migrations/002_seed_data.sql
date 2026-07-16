DO $$ 
DECLARE
  v_org_id UUID := '11111111-1111-1111-1111-111111111111';
  v_restaurant_id UUID := '22222222-2222-2222-2222-222222222222';
  v_cat_starters UUID := gen_random_uuid();
  v_cat_mains UUID := gen_random_uuid();
  v_cat_beverages UUID := gen_random_uuid();
  v_cat_desserts UUID := gen_random_uuid();
  v_cat_breads UUID := gen_random_uuid();
  
  v_item_butter_chicken UUID := gen_random_uuid();
  v_item_dal_makhani UUID := gen_random_uuid();
  v_item_paneer_tikka UUID := gen_random_uuid();
  v_item_samosa UUID := gen_random_uuid();
  v_item_naan UUID := gen_random_uuid();
  v_item_gulab_jamun UUID := gen_random_uuid();
  v_item_mango_lassi UUID := gen_random_uuid();
  
  v_tag_popular UUID;
  v_tag_chef_special UUID;
  v_tag_veg UUID;
BEGIN
  -- 1. Create Organization
  INSERT INTO organizations (id, name, slug) 
  VALUES (v_org_id, 'NexVelt Demo Org', 'nexvelt-demo')
  ON CONFLICT (slug) DO NOTHING;
  
  -- 2. Create Restaurant
  INSERT INTO restaurants (id, organization_id, name, restaurant_code, phone, email, gst_number, currency, timezone, business_type)
  VALUES (
    v_restaurant_id, 
    v_org_id, 
    'The Grand Kitchen', 
    'NXV-0001',
    '+911234567890', 
    'demo@grandkitchen.com', 
    '29ABCDE1234F1Z5', 
    'INR', 
    'Asia/Kolkata', 
    'restaurant'
  )
  ON CONFLICT (restaurant_code) DO NOTHING;
  
  -- 3. Create settings and workspace
  PERFORM create_restaurant_workspace(v_restaurant_id, 2, 9);
  
  -- 4. Create Categories
  INSERT INTO categories (id, restaurant_id, name, description, color, display_order, is_active)
  VALUES 
    (v_cat_starters, v_restaurant_id, 'Starters', 'Appetizers to begin your meal', '#F59E0B', 1, true),
    (v_cat_mains, v_restaurant_id, 'Main Course', 'Hearty main dishes', '#EF4444', 2, true),
    (v_cat_breads, v_restaurant_id, 'Breads', 'Freshly baked Indian breads', '#EAB308', 3, true),
    (v_cat_desserts, v_restaurant_id, 'Desserts', 'Sweet treats', '#EC4899', 4, true),
    (v_cat_beverages, v_restaurant_id, 'Beverages', 'Refreshing drinks', '#3B82F6', 5, true);
    
  -- 5. Create Menu Items
  INSERT INTO menu_items (id, restaurant_id, category_id, name, cost_price, selling_price, is_veg, prep_time, availability_status, display_order, image_url)
  VALUES
    (v_item_samosa, v_restaurant_id, v_cat_starters, 'Punjabi Samosa', 20.00, 60.00, true, 15, 'available', 1, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800'),
    (v_item_paneer_tikka, v_restaurant_id, v_cat_starters, 'Paneer Tikka', 120.00, 280.00, true, 20, 'available', 2, 'https://images.unsplash.com/photo-1599487405270-86430a6c0d40?w=800'),
    (v_item_butter_chicken, v_restaurant_id, v_cat_mains, 'Butter Chicken', 200.00, 450.00, false, 25, 'available', 1, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800'),
    (v_item_dal_makhani, v_restaurant_id, v_cat_mains, 'Dal Makhani', 100.00, 280.00, true, 20, 'available', 2, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800'),
    (v_item_naan, v_restaurant_id, v_cat_breads, 'Garlic Naan', 15.00, 50.00, true, 10, 'available', 1, 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800'),
    (v_item_gulab_jamun, v_restaurant_id, v_cat_desserts, 'Gulab Jamun (2pcs)', 30.00, 90.00, true, 5, 'available', 1, 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=800'),
    (v_item_mango_lassi, v_restaurant_id, v_cat_beverages, 'Mango Lassi', 40.00, 120.00, true, 5, 'available', 1, 'https://images.unsplash.com/photo-1571115177098-24de84b6f791?w=800');

  -- Get system tags
  SELECT id INTO v_tag_popular FROM tags WHERE slug = 'popular' AND is_system = true;
  SELECT id INTO v_tag_chef_special FROM tags WHERE slug = 'chef_special' AND is_system = true;
  SELECT id INTO v_tag_veg FROM tags WHERE slug = 'vegan' AND is_system = true;
  
  -- Assign Tags
  IF v_tag_popular IS NOT NULL THEN
    INSERT INTO menu_item_tags (menu_item_id, tag_id, restaurant_id) VALUES (v_item_butter_chicken, v_tag_popular, v_restaurant_id);
    INSERT INTO menu_item_tags (menu_item_id, tag_id, restaurant_id) VALUES (v_item_dal_makhani, v_tag_popular, v_restaurant_id);
  END IF;
  
  IF v_tag_chef_special IS NOT NULL THEN
    INSERT INTO menu_item_tags (menu_item_id, tag_id, restaurant_id) VALUES (v_item_paneer_tikka, v_tag_chef_special, v_restaurant_id);
  END IF;

END $$;
