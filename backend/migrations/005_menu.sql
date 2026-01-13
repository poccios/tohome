-- Migration: Add menu module
-- Creates tables for restaurant menu management with categories, products, and product options

-- 1. Create menu_categories table
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(restaurant_id, name)
);

-- 2. Create menu_products table
CREATE TABLE menu_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NULL,
  image_url TEXT NULL,
  base_price_cents INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allergens TEXT NULL,
  UNIQUE(restaurant_id, name)
);

-- 3. Create product_option_groups table
CREATE TABLE product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES menu_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_select INT NOT NULL DEFAULT 0,
  max_select INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
);

-- 4. Create product_option_items table
CREATE TABLE product_option_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta_cents INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

-- 5. Create indexes for performance
CREATE INDEX idx_menu_categories_restaurant_sort ON menu_categories(restaurant_id, sort_order);
CREATE INDEX idx_menu_products_restaurant_category_sort ON menu_products(restaurant_id, category_id, sort_order);
CREATE INDEX idx_product_option_groups_product_sort ON product_option_groups(product_id, sort_order);
CREATE INDEX idx_product_option_items_group_sort ON product_option_items(group_id, sort_order);
