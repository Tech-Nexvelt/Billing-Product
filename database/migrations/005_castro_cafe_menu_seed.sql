-- Delete every existing menu item and category belonging to this restaurant
DELETE FROM menu_item_tags WHERE restaurant_id = '172036e1-ff56-4c5e-82e3-56e4dc01d23c';
DELETE FROM menu_items WHERE restaurant_id = '172036e1-ff56-4c5e-82e3-56e4dc01d23c';
DELETE FROM categories WHERE restaurant_id = '172036e1-ff56-4c5e-82e3-56e4dc01d23c';

-- Declare category UUIDs to use as static variables
DO $$
DECLARE
  v_rest_id UUID := '172036e1-ff56-4c5e-82e3-56e4dc01d23c';
  
  v_cat_starters UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c10';
  v_cat_soups UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c11';
  v_cat_salads UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c12';
  v_cat_pastas UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c13';
  v_cat_burgers UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c14';
  v_cat_pizzas UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c15';
  v_cat_mocktails UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c16';
  v_cat_frappes UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c17';
  v_cat_hotcoffees UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c18';
  v_cat_hotteas UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c19';
  v_cat_icedteas UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c20';
  v_cat_sodas UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c21';
  v_cat_milkshakes UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c22';
  v_cat_thickshakes UUID := 'bfda6a50-e7f1-4db5-b82b-8a89df881c23';
BEGIN
  -- Insert categories exactly in the requested order
  INSERT INTO categories (id, restaurant_id, name, description, color, display_order, is_active)
  VALUES
    (v_cat_starters, v_rest_id, 'Starters', 'Delicious starters and appetizers', '#F59E0B', 1, true),
    (v_cat_soups, v_rest_id, 'Soups', 'Freshly brewed piping hot soups', '#10B981', 2, true),
    (v_cat_salads, v_rest_id, 'Salads', 'Fresh and healthy greens', '#3B82F6', 3, true),
    (v_cat_pastas, v_rest_id, 'Pastas', 'Authentic Italian pastas', '#8B5CF6', 4, true),
    (v_cat_burgers, v_rest_id, 'Burgers & Sandwiches', 'Gourmet burgers and grilled sandwiches', '#EC4899', 5, true),
    (v_cat_pizzas, v_rest_id, 'Pizzas', 'Freshly baked thin crust pizzas', '#EF4444', 6, true),
    (v_cat_mocktails, v_rest_id, 'Mocktails', 'Refreshing non-alcoholic beverages', '#06B6D4', 7, true),
    (v_cat_frappes, v_rest_id, 'Frappes', 'Chilled blended cold coffees', '#F97316', 8, true),
    (v_cat_hotcoffees, v_rest_id, 'Hot Coffees', 'Classic brewed hot coffees', '#78350F', 9, true),
    (v_cat_hotteas, v_rest_id, 'Hot Teas', 'Infused organic hot teas', '#059669', 10, true),
    (v_cat_icedteas, v_rest_id, 'Iced Teas', 'Refreshing chilled iced teas', '#3B82F6', 11, true),
    (v_cat_sodas, v_rest_id, 'Sodas', 'Flavored fizzy sodas', '#EAB308', 12, true),
    (v_cat_milkshakes, v_rest_id, 'Milkshakes', 'Thick creamy blended milkshakes', '#EC4899', 13, true),
    (v_cat_thickshakes, v_rest_id, 'Thick Shakes', 'Premium dense thick shakes', '#D946EF', 14, true);

  -- 1. Starters
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_starters, 'Crispy Chicken', 'Deep-fried breaded chicken pieces served hot and crispy.', 100.00, 220.00, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800', 'Crispy Chicken Starters', false, 15, 'available', 'STR-001', '8901234560012', 1),
    (v_rest_id, v_cat_starters, 'Crispy Spicy Potato Wedge', 'Thick cut potato wedges seasoned with spicy herbs and baked to crisp.', 60.00, 150.00, 'https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=800', 'Crispy Spicy Potato Wedge', true, 15, 'available', 'STR-002', '8901234560029', 2),
    (v_rest_id, v_cat_starters, 'Cheese Garlic Bread', 'Toasted slices of bread topped with garlic butter and melted cheese.', 40.00, 100.00, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=800', 'Cheese Garlic Bread', true, 10, 'available', 'STR-003', '8901234560036', 3),
    (v_rest_id, v_cat_starters, 'Speriata Cheese Toast', 'Signature crispy toast loaded with mixed cheeses and fresh herbs.', 45.00, 100.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800', 'Speriata Cheese Toast', true, 10, 'available', 'STR-004', '8901234560043', 4),
    (v_rest_id, v_cat_starters, 'French Fries', 'Classic salted golden French fries served with ketchup.', 50.00, 120.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800', 'French Fries', true, 10, 'available', 'STR-005', '8901234560050', 5),
    (v_rest_id, v_cat_starters, 'Chessy Loaded Fries', 'Crispy French fries smothered in warm cheese sauce and jalapeños.', 70.00, 150.00, 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800', 'Chessy Loaded Fries', true, 12, 'available', 'STR-006', '8901234560067', 6),
    (v_rest_id, v_cat_starters, 'Peri Peri Fries', 'Golden French fries tossed in spicy peri peri seasoning.', 60.00, 140.00, 'https://images.unsplash.com/photo-1600957244641-f0b98acc0519?w=800', 'Peri Peri Fries', true, 10, 'available', 'STR-007', '8901234560074', 7),
    (v_rest_id, v_cat_starters, 'Fish Fingers', 'Breaded fish fillets fried to golden perfection, served with tartar sauce.', 90.00, 200.00, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800', 'Fish Fingers', false, 15, 'available', 'STR-008', '8901234560081', 8),
    (v_rest_id, v_cat_starters, 'Hot Garlic Chicken Wings', 'Crispy chicken wings tossed in a spicy, savory hot garlic sauce.', 85.00, 190.00, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800', 'Hot Garlic Chicken Wings', false, 18, 'available', 'STR-009', '8901234560098', 9),
    (v_rest_id, v_cat_starters, 'Barbique Chicken Wings', 'Tender chicken wings coated in rich and smoky barbecue sauce.', 85.00, 190.00, 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=800', 'Barbique Chicken Wings', false, 18, 'available', 'STR-010', '8901234560104', 10),
    (v_rest_id, v_cat_starters, 'Spicy Tangy Prawns', 'Juicy prawns tossed in a fiery, tangy house sauce with bell peppers.', 110.00, 240.00, 'https://images.unsplash.com/photo-1559737607-ff828242f3f9?w=800', 'Spicy Tangy Prawns', false, 15, 'available', 'STR-011', '8901234560111', 11),
    (v_rest_id, v_cat_starters, 'Paneer Poppers', 'Bite-sized crispy paneer cubes seasoned with spices and herbs.', 80.00, 190.00, 'https://images.unsplash.com/photo-1599487405270-86430a6c0d40?w=800', 'Paneer Poppers', true, 12, 'available', 'STR-012', '8901234560128', 12),
    (v_rest_id, v_cat_starters, 'Cheesy Potato Shots', 'Crispy potato bites filled with gooey melted cheese inside.', 55.00, 130.00, 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=800', 'Cheesy Potato Shots', true, 10, 'available', 'STR-013', '8901234560135', 13),
    (v_rest_id, v_cat_starters, 'Veg Nuggets', 'Crispy breaded vegetable nuggets packed with carrots, peas, and potatoes.', 55.00, 130.00, 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800', 'Veg Nuggets', true, 10, 'available', 'STR-014', '8901234560142', 14),
    (v_rest_id, v_cat_starters, 'Veg Nuggets', 'Crispy breaded vegetable nuggets packed with carrots, peas, and potatoes.', 55.00, 130.00, 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800', 'Veg Nuggets', true, 10, 'available', 'STR-014', '8901234560142', 14),
    (v_rest_id, v_cat_starters, 'Veg Fingers', 'Crispy mixed vegetable sticks seasoned with mild spices.', 55.00, 130.00, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800', 'Veg Fingers', true, 10, 'available', 'STR-015', '8901234560159', 15),
    (v_rest_id, v_cat_starters, 'Chicken Popcorn', 'Mini breaded chicken bites fried until crispy and seasoned.', 90.00, 200.00, 'https://images.unsplash.com/photo-1569058242252-623df46b5025?w=800', 'Chicken Popcorn', false, 12, 'available', 'STR-016', '8901234560166', 16),
    (v_rest_id, v_cat_starters, 'Chicken Nuggets', 'Classic golden chicken nuggets served with honey mustard sauce.', 80.00, 170.00, 'https://images.unsplash.com/photo-1562967915-92ae0c320a01?w=800', 'Chicken Nuggets', false, 12, 'available', 'STR-017', '8901234560173', 17);

  -- 2. Soups
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_soups, 'Cream of Mushroom Soup', 'Rich and creamy soup prepared with fresh button mushrooms and cream.', 40.00, 90.00, 'https://images.unsplash.com/photo-1547592165-e1d17fed6006?w=800', 'Cream of Mushroom Soup', true, 12, 'available', 'SOP-001', '8901234560180', 1),
    (v_rest_id, v_cat_soups, 'Lemon Coriander Soup', 'Clear vegetable broth infused with fresh lemon and coriander leaves.', 35.00, 80.00, 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=800', 'Lemon Coriander Soup', true, 10, 'available', 'SOP-002', '8901234560197', 2);

  -- 3. Salads
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_salads, 'Fully Loaded Iceburg Salad', 'Fresh iceberg lettuce tossed with olives, tomatoes, cucumbers, and vinaigrette dressing.', 80.00, 180.00, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', 'Fully Loaded Iceburg Salad', true, 10, 'available', 'SLD-001', '8901234560203', 1),
    (v_rest_id, v_cat_salads, 'Grilled Chicken with Saffron Soup', 'Delicious grilled chicken breast strips accompanied by a rich saffron broth.', 105.00, 230.00, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800', 'Grilled Chicken with Saffron Soup', false, 15, 'available', 'SLD-002', '8901234560210', 2);

  -- 4. Pastas
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_pastas, 'Alfredo (Veg)', 'Penne pasta tossed in a rich, creamy white sauce with Parmesan and mushrooms.', 80.00, 180.00, 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800', 'Alfredo Veg', true, 15, 'available', 'PST-001', '8901234560227', 1),
    (v_rest_id, v_cat_pastas, 'Alfredo (Chicken)', 'Penne pasta with grilled chicken slices in a creamy white Alfredo sauce.', 95.00, 210.00, 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800', 'Alfredo Chicken', false, 18, 'available', 'PST-002', '8901234560234', 2),
    (v_rest_id, v_cat_pastas, 'Arrabiatta (Chicken)', 'Penne pasta with chicken in a fiery tomato sauce with garlic and red chili.', 100.00, 220.00, 'https://images.unsplash.com/photo-1563379971899-660589a01cc3?w=800', 'Arrabiatta Chicken', false, 18, 'available', 'PST-003', '8901234560241', 3),
    (v_rest_id, v_cat_pastas, 'Arrabiatta (Veg)', 'Penne pasta tossed in spicy red marinara sauce with fresh basil and olives.', 85.00, 190.00, 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=800', 'Arrabiatta Veg', true, 15, 'available', 'PST-004', '8901234560258', 4),
    (v_rest_id, v_cat_pastas, 'Basil Pesto', 'Pasta coated in a fresh basil, pine nut, and olive oil pesto sauce.', 95.00, 210.00, 'https://images.unsplash.com/photo-1558985250-27a406d64cb3?w=800', 'Basil Pesto', true, 15, 'available', 'PST-005', '8901234560265', 5),
    (v_rest_id, v_cat_pastas, 'Chicken Aglioolio', 'Classic pasta tossed in olive oil, sautéed garlic, chili flakes, and grilled chicken.', 90.00, 200.00, 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?w=800', 'Chicken Aglioolio', false, 15, 'available', 'PST-006', '8901234560272', 6);

  -- 5. Burgers & Sandwiches
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_burgers, 'Veg Burger', 'Crispy vegetable patty in toasted buns with lettuce, tomato, and house mayo.', 55.00, 130.00, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800', 'Veg Burger', true, 12, 'available', 'BGS-001', '8901234560289', 1),
    (v_rest_id, v_cat_burgers, 'Honey BBQ Chicken Burger', 'Grilled chicken patty glazed with sweet honey BBQ sauce, lettuce, and onions.', 80.00, 180.00, 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=800', 'Honey BBQ Chicken Burger', false, 15, 'available', 'BGS-002', '8901234560296', 2),
    (v_rest_id, v_cat_burgers, 'Cheesy Chicken Burger', 'Crispy chicken patty with double melted cheese, pickles, and classic burger sauce.', 85.00, 190.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800', 'Cheesy Chicken Burger', false, 15, 'available', 'BGS-003', '8901234560302', 3),
    (v_rest_id, v_cat_burgers, 'Chicken Burger', 'Toasted buns with a crispy chicken breast patty, fresh lettuce, and mayonnaise.', 80.00, 180.00, 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=800', 'Chicken Burger', false, 15, 'available', 'BGS-004', '8901234560319', 4),
    (v_rest_id, v_cat_burgers, 'Grilled Veg Sandwich', 'Grilled bread slices filled with fresh cucumbers, tomatoes, potatoes, and green chutney.', 60.00, 140.00, 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=800', 'Grilled Veg Sandwich', true, 10, 'available', 'BGS-005', '8901234560326', 5),
    (v_rest_id, v_cat_burgers, 'Cheesy Mushroom Sandwich', 'Sautéed mushrooms, onions, and melted cheese toasted in sandwich bread.', 65.00, 150.00, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800', 'Cheesy Mushroom Sandwich', true, 10, 'available', 'BGS-006', '8901234560333', 6),
    (v_rest_id, v_cat_burgers, 'Italian Chicken Sandwich', 'Grilled chicken strips, bell peppers, pesto, and cheese pressed in Italian bread.', 75.00, 160.00, 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=800', 'Italian Chicken Sandwich', false, 12, 'available', 'BGS-007', '8901234560340', 7);

  -- 6. Pizzas
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_pizzas, 'Margarita Pizza', 'Classic cheese pizza topped with tomato sauce, fresh mozzarella, and basil.', 60.00, 140.00, 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800', 'Margarita Pizza', true, 15, 'available', 'PIZ-001', '8901234560357', 1),
    (v_rest_id, v_cat_pizzas, 'Farm House Pizza', 'Loaded with crisp onions, capsicum, fresh tomatoes, and mushrooms.', 75.00, 170.00, 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=800', 'Farm House Pizza', true, 18, 'available', 'PIZ-002', '8901234560364', 2),
    (v_rest_id, v_cat_pizzas, 'Pizza Verdure Pizza', 'Italian thin crust pizza loaded with zucchini, bell peppers, broccoli, and olives.', 85.00, 190.00, 'https://images.unsplash.com/photo-1544982503-9f984c14501a?w=800', 'Pizza Verdure Pizza', true, 18, 'available', 'PIZ-003', '8901234560371', 3),
    (v_rest_id, v_cat_pizzas, 'Spicy Mushroom Pizza', 'Rich cheese pizza topped with spicy garlic mushrooms and red chili flakes.', 80.00, 180.00, 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=800', 'Spicy Mushroom Pizza', true, 15, 'available', 'PIZ-004', '8901234560388', 4),
    (v_rest_id, v_cat_pizzas, 'Pepper Chicken Pizza', 'Spiced chicken cubes, black pepper, and onions over rich mozzarella cheese.', 100.00, 220.00, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800', 'Pepper Chicken Pizza', false, 18, 'available', 'PIZ-005', '8901234560395', 5),
    (v_rest_id, v_cat_pizzas, 'Tandoori Paneer', 'Spiced tandoori paneer cubes, green chilies, capsicum, and onions.', 85.00, 190.00, 'https://images.unsplash.com/photo-1573821663912-569905455b1c?w=800', 'Tandoori Paneer', true, 18, 'available', 'PIZ-006', '8901234560401', 6),
    (v_rest_id, v_cat_pizzas, 'Tandoori Chicken', 'Classic Indian flavor of spicy tandoori chicken cubes with capsicum and red onions.', 95.00, 210.00, 'https://images.unsplash.com/photo-1594007654729-407ededc49c8?w=800', 'Tandoori Chicken', false, 18, 'available', 'PIZ-007', '8901234560418', 7),
    (v_rest_id, v_cat_pizzas, 'Chicken Speriato Pizza', 'Signature chef-special loaded chicken pizza with three varieties of cheese.', 95.00, 210.00, 'https://images.unsplash.com/photo-1604917621956-10dfa7cce2e7?w=800', 'Chicken Speriato Pizza', false, 18, 'available', 'PIZ-008', '8901234560425', 8),
    (v_rest_id, v_cat_pizzas, 'Prawn Pizza', 'Creamy white garlic sauce base topped with succulent marinated prawns and herbs.', 110.00, 240.00, 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=800', 'Prawn Pizza', false, 20, 'available', 'PIZ-009', '8901234560432', 9),
    (v_rest_id, v_cat_pizzas, 'Speziatto Veg Pizza', 'Extremely spicy pizza with jalapeños, red paprika, baby corn, and green chilies.', 95.00, 210.00, 'https://images.unsplash.com/photo-1628824851022-e446af7f0591?w=800', 'Speziatto Veg Pizza', true, 18, 'available', 'PIZ-010', '8901234560449', 10);

  -- 7. Mocktails
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_mocktails, 'Virgin Mojito', 'Classic refreshing drink made with mint leaves, fresh lime juice, sugar syrup, and soda.', 30.00, 90.00, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800', 'Virgin Mojito', true, 5, 'available', 'MOC-001', '8901234560456', 1),
    (v_rest_id, v_cat_mocktails, 'Blue Beach', 'Striking blue drink with blue curaçao, lemon juice, sugar, and sparkling soda.', 30.00, 90.00, 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=800', 'Blue Beach Mocktail', true, 5, 'available', 'MOC-002', '8901234560463', 2),
    (v_rest_id, v_cat_mocktails, 'Basil Blue Berry', 'Blend of muddled blueberries, fresh basil leaves, lemon juice, and soda.', 30.00, 90.00, 'https://images.unsplash.com/photo-1546173159-315724a31d96?w=800', 'Basil Blue Berry', true, 5, 'available', 'MOC-003', '8901234560470', 3),
    (v_rest_id, v_cat_mocktails, 'Cardamom Crush', 'Unique fusion mocktail crushed with fresh green cardamom, lemon juice, and soda.', 35.00, 110.00, 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=800', 'Cardamom Crush', true, 5, 'available', 'MOC-004', '8901234560487', 4),
    (v_rest_id, v_cat_mocktails, 'Fresh Lime Sweet', 'Sweetened lime syrup mixed with chilled water or soda.', 20.00, 70.00, 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800', 'Fresh Lime Sweet', true, 3, 'available', 'MOC-005', '8901234560494', 5),
    (v_rest_id, v_cat_mocktails, 'Fresh Lime Salt', 'Salted fresh lime juice mixed with chilled soda.', 20.00, 70.00, 'https://images.unsplash.com/photo-1560512823-829485b8bf24?w=800', 'Fresh Lime Salt', true, 3, 'available', 'MOC-006', '8901234560500', 6),
    (v_rest_id, v_cat_mocktails, 'Green Ginger Mint', 'Zesty green drink crushed with fresh ginger extract, mint, lime, and soda.', 30.00, 90.00, 'https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=800', 'Green Ginger Mint', true, 5, 'available', 'MOC-007', '8901234560517', 7);

  -- 8. Frappes
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_frappes, 'Frappuccino', 'Rich chilled espresso blended with milk, sweet syrup, and ice, topped with cream.', 40.00, 90.00, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800', 'Frappuccino', true, 8, 'available', 'FRP-001', '8901234560524', 1),
    (v_rest_id, v_cat_frappes, 'Chocolate Frappe', 'Iced blended coffee with chocolate chips, milk, cocoa syrup, and whipped cream.', 45.00, 100.00, 'https://images.unsplash.com/photo-1579888074090-399c23de6477?w=800', 'Chocolate Frappe', true, 8, 'available', 'FRP-002', '8901234560531', 2),
    (v_rest_id, v_cat_frappes, 'Royal Frappe', 'Premium chilled coffee blended with rich dynamic caramel syrup and vanilla ice cream.', 60.00, 140.00, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800', 'Royal Frappe', true, 10, 'available', 'FRP-003', '8901234560548', 3),
    (v_rest_id, v_cat_frappes, 'DYO Frappe', 'Design Your Own Frappe - choose your custom syrups and ice cream flavors.', 50.00, 120.00, 'https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=800', 'DYO Frappe', true, 10, 'available', 'FRP-004', '8901234560555', 4);

  -- 9. Hot Coffees
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_hotcoffees, 'Cappuccino', 'Espresso shot topped with steamed milk foam in equal parts.', 30.00, 80.00, 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=800', 'Cappuccino', true, 5, 'available', 'HOT-001', '8901234560562', 1),
    (v_rest_id, v_cat_hotcoffees, 'Cafe Mocha', 'Espresso combined with sweet chocolate syrup, steamed milk, and cocoa powder.', 35.00, 90.00, 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=800', 'Cafe Mocha', true, 5, 'available', 'HOT-002', '8901234560579', 2),
    (v_rest_id, v_cat_hotcoffees, 'Cafe Latte', 'Single espresso shot with plenty of steamed milk and a thin layer of foam.', 30.00, 80.00, 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=800', 'Cafe Latte', true, 5, 'available', 'HOT-003', '8901234560586', 3),
    (v_rest_id, v_cat_hotcoffees, 'Macchiato', 'Strong espresso marked with a small dollop of steamed milk foam.', 25.00, 60.00, 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=800', 'Macchiato', true, 4, 'available', 'HOT-004', '8901234560593', 4),
    (v_rest_id, v_cat_hotcoffees, 'Espresso', 'Concentrated coffee brewed by forcing hot water through finely-ground beans.', 25.00, 60.00, 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800', 'Espresso', true, 3, 'available', 'HOT-005', '8901234560609', 5),
    (v_rest_id, v_cat_hotcoffees, 'Doppio', 'Double shot of rich espresso for extra caffeine kick.', 30.00, 70.00, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800', 'Doppio', true, 3, 'available', 'HOT-006', '8901234560616', 6),
    (v_rest_id, v_cat_hotcoffees, 'Americano Black', 'Espresso shots diluted with hot water, serving a strong black coffee.', 30.00, 70.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800', 'Americano Black', true, 4, 'available', 'HOT-007', '8901234560623', 7),
    (v_rest_id, v_cat_hotcoffees, 'Irish Black', 'Strong black coffee infused with sweet non-alcoholic Irish cream syrup.', 35.00, 90.00, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800', 'Irish Black', true, 5, 'available', 'HOT-008', '8901234560630', 8),
    (v_rest_id, v_cat_hotcoffees, 'Espresso with Chocolate', 'Strong espresso shot infused with rich dark chocolate fudge syrup.', 35.00, 80.00, 'https://images.unsplash.com/photo-1606791405792-1004f1718d0c?w=800', 'Espresso with Chocolate', true, 5, 'available', 'HOT-009', '8901234560647', 9);

  -- 10. Hot Teas
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_hotteas, 'Assam Tea', 'Traditional strong black tea brewed with rich Assam tea leaves and milk.', 10.00, 30.00, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800', 'Assam Tea', true, 5, 'available', 'TEA-001', '8901234560654', 1),
    (v_rest_id, v_cat_hotteas, 'Green Tea', 'Chilled or hot organic green tea leaves infused with hot water.', 10.00, 30.00, 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=800', 'Green Tea', true, 4, 'available', 'TEA-002', '8901234560661', 2),
    (v_rest_id, v_cat_hotteas, 'Hibiscus Tea', 'Infusion of deep red hibiscus petals serving a tangy, sweet tea.', 10.00, 30.00, 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=800', 'Hibiscus Tea', true, 5, 'available', 'TEA-003', '8901234560678', 3),
    (v_rest_id, v_cat_hotteas, 'Lemon Tea', 'Refreshing black tea brewed with lemon juice and sweetened with honey.', 10.00, 30.00, 'https://images.unsplash.com/photo-1554981286-fc6915169721?w=800', 'Lemon Tea', true, 5, 'available', 'TEA-004', '8901234560685', 4);

  -- 11. Iced Teas
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_icedteas, 'Lemon Ice Tea', 'Chilled sweetened black tea infused with lemon syrup and served with ice.', 25.00, 70.00, 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=800', 'Lemon Ice Tea', true, 4, 'available', 'ICT-001', '8901234560692', 1),
    (v_rest_id, v_cat_icedteas, 'Lady in Red', 'Zesty red iced tea infused with berries, hibiscus extracts, and lime.', 25.00, 70.00, 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800', 'Lady in Red Iced Tea', true, 4, 'available', 'ICT-002', '8901234560708', 2),
    (v_rest_id, v_cat_icedteas, 'Peach Ice Tea', 'Sweet and crisp iced black tea flavored with sweet peach extract.', 25.00, 70.00, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800', 'Peach Ice Tea', true, 4, 'available', 'ICT-003', '8901234560715', 3);

  -- 12. Sodas
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_sodas, 'Mango Soda', 'Zesty mango syrup combined with sparkling soda and ice.', 30.00, 90.00, 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=800', 'Mango Soda', true, 3, 'available', 'SDA-001', '8901234560722', 1),
    (v_rest_id, v_cat_sodas, 'Ginger Mint Soda', 'Sparkling soda mixed with fresh ginger paste, mint leaves, and lime juice.', 30.00, 90.00, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800', 'Ginger Mint Soda', true, 3, 'available', 'SDA-002', '8901234560739', 2);

  -- 13. Milkshakes
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_milkshakes, 'Vanilla Milkshake', 'Classic rich vanilla milkshake made with vanilla ice cream and chilled milk.', 35.00, 90.00, 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=800', 'Vanilla Milkshake', true, 6, 'available', 'MSK-001', '8901234560746', 1),
    (v_rest_id, v_cat_milkshakes, 'Belgian Chocolate Milkshake', 'Decadent milkshake made with premium dark Belgian chocolate ice cream and syrup.', 40.00, 90.00, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800', 'Belgian Chocolate Milkshake', true, 6, 'available', 'MSK-002', '8901234560753', 2),
    (v_rest_id, v_cat_milkshakes, 'Strawberry Milkshake', 'Sweet and creamy shake prepared with fresh strawberries and vanilla ice cream.', 35.00, 90.00, 'https://images.unsplash.com/photo-1553787499-6f9133860275?w=800', 'Strawberry Milkshake', true, 6, 'available', 'MSK-003', '8901234560760', 3),
    (v_rest_id, v_cat_milkshakes, 'Butterscotch Milkshake', 'Rich milkshake blended with sweet butterscotch crunch and ice cream.', 35.00, 90.00, 'https://images.unsplash.com/photo-1586985289688-ca9cf499191a?w=800', 'Butterscotch Milkshake', true, 6, 'available', 'MSK-004', '8901234560777', 4);

  -- 14. Thick Shakes
  INSERT INTO menu_items (restaurant_id, category_id, name, description, cost_price, selling_price, image_url, image_alt, is_veg, prep_time, availability_status, sku, barcode, display_order) VALUES
    (v_rest_id, v_cat_thickshakes, 'Red Velvet Thick Shake', 'Super thick milkshake blended with red velvet cake crumbles and white chocolate.', 45.00, 110.00, 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=800', 'Red Velvet Thick Shake', true, 8, 'available', 'TSK-001', '8901234560784', 1),
    (v_rest_id, v_cat_thickshakes, 'Brownie Thick Shake', 'Decadent thick shake blended with chocolate fudge brownie chunks.', 45.00, 110.00, 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=800', 'Brownie Thick Shake', true, 8, 'available', 'TSK-002', '8901234560791', 2),
    (v_rest_id, v_cat_thickshakes, 'Oreo Thick Shake', 'Indulgent thick shake blended with crunchy Oreo cookies and whipped cream.', 45.00, 110.00, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800', 'Oreo Thick Shake', true, 8, 'available', 'TSK-003', '8901234560807', 3),
    (v_rest_id, v_cat_thickshakes, 'Customize Thick Shake', 'Thick customized shake - pick your own premium ice creams and toppings.', 45.00, 110.00, 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=800', 'Customize Thick Shake', true, 10, 'available', 'TSK-004', '8901234560814', 4),
    (v_rest_id, v_cat_thickshakes, 'Chocolate Thick Shake', 'Heavy, ultra-creamy shake with double shots of premium chocolate fudge.', 45.00, 110.00, 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=800', 'Chocolate Thick Shake', true, 8, 'available', 'TSK-005', '8901234560821', 5);

END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- 1. Check categories counts and order
SELECT id, name, display_order FROM categories WHERE restaurant_id = '172036e1-ff56-4c5e-82e3-56e4dc01d23c' ORDER BY display_order ASC;

-- 2. Check total menu items created
SELECT COUNT(*), category_id FROM menu_items WHERE restaurant_id = '172036e1-ff56-4c5e-82e3-56e4dc01d23c' GROUP BY category_id;

-- 3. Show details of parsed items to verify
SELECT sku, barcode, name, selling_price, is_veg FROM menu_items WHERE restaurant_id = '172036e1-ff56-4c5e-82e3-56e4dc01d23c' ORDER BY sku ASC;
