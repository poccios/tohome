-- Migration 008: Restaurant Force Closed (Kill Switch)
-- Allows manually forcing a restaurant closed regardless of hours/overrides

ALTER TABLE restaurants
ADD COLUMN force_closed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN force_closed_note TEXT;

-- Index for filtering by force_closed status
CREATE INDEX idx_restaurants_force_closed ON restaurants(force_closed) WHERE force_closed = true;
