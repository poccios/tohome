-- PASSO 9: Orders module
-- Create tables for orders, order items, and order item options with price snapshots

-- Create order status enum
CREATE TYPE order_status AS ENUM (
  'CREATED',
  'PAID',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'DELIVERING',
  'DELIVERED',
  'CANCELLED'
);

-- Create payment method enum
CREATE TYPE payment_method AS ENUM ('ONLINE', 'CASH');

-- Create payment status enum
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID');

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  status order_status NOT NULL DEFAULT 'CREATED',
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  subtotal_cents INT NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents INT NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  service_fee_cents INT NOT NULL DEFAULT 0 CHECK (service_fee_cents >= 0),
  total_cents INT NOT NULL CHECK (total_cents >= 0),
  address_json JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Order items table (snapshot of product at order time)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES menu_products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0),
  qty INT NOT NULL CHECK (qty > 0),
  total_cents INT NOT NULL CHECK (total_cents >= 0)
);

-- Order item options table (snapshot of option at order time)
CREATE TABLE order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  price_delta_cents INT NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_item_options_item ON order_item_options(order_item_id);
