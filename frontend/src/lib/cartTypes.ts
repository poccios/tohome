/**
 * Cart Data Types
 */

export interface CartOption {
  group_id: string;
  group_name: string;
  item_id: string;
  item_name: string;
  price_delta_cents: number;
}

export interface CartItem {
  key: string; // unique key: product_id + sorted options
  product_id: string;
  name: string;
  base_price_cents: number;
  qty: number;
  options: CartOption[];
  item_total_cents: number; // (base + sum of deltas) * qty
}

export interface CartState {
  restaurant_id: string;
  restaurant_slug: string;
  restaurant_name: string;
  items: CartItem[];
}

export interface CartTotals {
  subtotal_cents: number;
  total_items: number;
}
