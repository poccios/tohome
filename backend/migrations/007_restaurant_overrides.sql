-- Migration 007: Restaurant Daily Overrides
-- Allows setting special hours or closures for specific dates

CREATE TABLE IF NOT EXISTS restaurant_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  open_time TEXT,  -- HH:MM format
  close_time TEXT, -- HH:MM format
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(restaurant_id, date)
);

CREATE INDEX idx_restaurant_overrides_restaurant_id ON restaurant_overrides(restaurant_id);
CREATE INDEX idx_restaurant_overrides_date ON restaurant_overrides(date);
CREATE INDEX idx_restaurant_overrides_restaurant_date ON restaurant_overrides(restaurant_id, date);
