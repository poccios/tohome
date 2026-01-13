-- Migration: Add restaurants module
-- Creates tables for restaurant management with hours and delivery rules

-- 1. Ensure pgcrypto extension is available (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create restaurants table
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  phone TEXT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  zone TEXT NULL,
  lat DOUBLE PRECISION NULL,
  lng DOUBLE PRECISION NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create restaurant_hours table
CREATE TABLE restaurant_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false
);

-- 4. Create restaurant_delivery_rules table
CREATE TABLE restaurant_delivery_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  min_order_cents INT NOT NULL DEFAULT 0,
  delivery_fee_cents INT NOT NULL DEFAULT 0,
  eta_min INT NOT NULL DEFAULT 25,
  eta_max INT NOT NULL DEFAULT 45
);

-- 5. Create indexes for performance
CREATE INDEX idx_restaurants_is_active ON restaurants(is_active);
CREATE INDEX idx_restaurants_zone ON restaurants(zone);
CREATE INDEX idx_restaurant_hours_restaurant_day ON restaurant_hours(restaurant_id, day_of_week);
