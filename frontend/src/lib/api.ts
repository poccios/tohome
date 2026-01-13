/**
 * API Client - Type-safe API calls to backend
 */

import { httpClient } from './http';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface MeResponse {
  user: User;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  zone: string | null;
  open_time: string | null;
  close_time: string | null;
  eta_min: number;
  eta_max: number;
  delivery_fee: number;
  min_order: number;
  status: string;
  is_open?: boolean;
}

export interface GetRestaurantsResponse {
  restaurants: Restaurant[];
}

export interface RestaurantDetail extends Restaurant {
  address?: string;
  city?: string;
  description?: string;
  phone?: string;
}

export interface OptionItem {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
}

export interface OptionGroup {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  items: OptionItem[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  is_available: boolean;
  sort_order: number;
  option_groups: OptionGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  products: Product[];
}

export interface GetRestaurantResponse {
  restaurant: RestaurantDetail;
}

export interface GetMenuResponse {
  categories: MenuCategory[];
}

// ============================================================================
// Auth & User APIs
// ============================================================================

/**
 * Get current user information
 * Requires valid access_token cookie
 * @throws HttpError with status 401 if not authenticated
 */
export async function getMe(): Promise<MeResponse> {
  return httpClient.get<MeResponse>('/me');
}

/**
 * Request OTP code via email
 */
export async function requestOTP(email: string, device_id?: string): Promise<{ ok: boolean; message: string; debug_code?: string }> {
  return httpClient.post('/auth/email-otp/request', {
    email,
    device_id,
  });
}

/**
 * Verify OTP code
 * Sets httpOnly cookies on success
 */
export async function verifyOTP(
  email: string,
  code: string,
  device_id?: string
): Promise<{ ok: boolean }> {
  return httpClient.post('/auth/email-otp/verify', {
    email,
    code,
    device_id,
  });
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(): Promise<{ ok: boolean }> {
  return httpClient.post('/auth/token/refresh');
}

// ============================================================================
// Restaurant APIs
// ============================================================================

/**
 * Get list of restaurants
 * @param params - Optional filters (open_now, zone)
 */
export async function getRestaurants(params?: {
  open_now?: boolean;
  zone?: string;
}): Promise<GetRestaurantsResponse> {
  const queryParams = new URLSearchParams();

  if (params?.open_now !== undefined) {
    queryParams.append('open_now', params.open_now.toString());
  }

  if (params?.zone) {
    queryParams.append('zone', params.zone);
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/restaurants?${queryString}` : '/restaurants';

  const data = await httpClient.get<any>(path);

  // Normalize response shape
  let rawRestaurants: any[];
  if (Array.isArray(data)) {
    rawRestaurants = data;
  } else if (data && Array.isArray(data.data)) {
    rawRestaurants = data.data;
  } else if (data && Array.isArray(data.restaurants)) {
    rawRestaurants = data.restaurants;
  } else {
    rawRestaurants = [];
  }

  // Map backend structure to frontend Restaurant type
  const restaurants: Restaurant[] = rawRestaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    zone: r.zone,
    open_time: r.open_time,
    close_time: r.close_time,
    eta_min: r.delivery_rules?.eta_min ?? r.eta_min ?? 20,
    eta_max: r.delivery_rules?.eta_max ?? r.eta_max ?? 40,
    delivery_fee: r.delivery_rules?.delivery_fee_cents ?? r.delivery_fee ?? 0,
    min_order: r.delivery_rules?.min_order_cents ?? r.min_order ?? 0,
    status: r.status ?? (r.is_active ? 'active' : 'inactive'),
    is_open: r.is_open_now ?? r.is_open,
  }));

  return { restaurants };
}

/**
 * Get restaurant detail by slug
 * @param slug - Restaurant slug
 */
export async function getRestaurant(slug: string): Promise<GetRestaurantResponse> {
  const data = await httpClient.get<any>(`/restaurants/${slug}`);

  // Normalize response
  let restaurant: any;
  if (data && data.data) {
    restaurant = data.data;
  } else if (data && data.restaurant) {
    restaurant = data.restaurant;
  } else {
    restaurant = data;
  }

  // Map to RestaurantDetail
  const detail: RestaurantDetail = {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    zone: restaurant.zone,
    address: restaurant.address,
    city: restaurant.city,
    description: restaurant.description,
    phone: restaurant.phone,
    open_time: restaurant.open_time,
    close_time: restaurant.close_time,
    eta_min: restaurant.delivery_rules?.eta_min ?? restaurant.eta_min ?? 20,
    eta_max: restaurant.delivery_rules?.eta_max ?? restaurant.eta_max ?? 40,
    delivery_fee: restaurant.delivery_rules?.delivery_fee_cents ?? restaurant.delivery_fee ?? 0,
    min_order: restaurant.delivery_rules?.min_order_cents ?? restaurant.min_order ?? 0,
    status: restaurant.status ?? (restaurant.is_active ? 'active' : 'inactive'),
    is_open: restaurant.is_open_now ?? restaurant.is_open,
  };

  return { restaurant: detail };
}

/**
 * Get restaurant menu by slug
 * @param slug - Restaurant slug
 */
export async function getRestaurantMenu(slug: string): Promise<GetMenuResponse> {
  const data = await httpClient.get<any>(`/restaurants/${slug}/menu`);

  // Normalize response
  let categories: MenuCategory[];
  if (Array.isArray(data)) {
    categories = data;
  } else if (data && data.data && Array.isArray(data.data.categories)) {
    // Backend returns { ok: true, data: { restaurant: {...}, categories: [...] } }
    categories = data.data.categories;
  } else if (data && Array.isArray(data.data)) {
    categories = data.data;
  } else if (data && Array.isArray(data.categories)) {
    categories = data.categories;
  } else {
    categories = [];
  }

  // Sort categories and products, map availability
  categories = categories
    .map((cat) => ({
      ...cat,
      products: (cat.products || [])
        .map((product: any) => ({
          ...product,
          is_available: product.is_available ?? product.is_active ?? true,
          option_groups: (product.option_groups || []).map((group: any) => ({
            ...group,
            items: (group.items || []).map((item: any) => ({
              ...item,
              is_available: item.is_available ?? item.is_active ?? true,
            })),
          })),
        }))
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  return { categories };
}

// ============================================================================
// Order APIs
// ============================================================================

export interface OrderItem {
  product_id: string;
  qty: number;
  options: Array<{
    group_id: string;
    item_id: string;
  }>;
}

export interface CreateOrderPayload {
  restaurant_id: string;
  payment_method: 'CASH' | 'ONLINE';
  address: {
    street: string;
    number: string;
    city: string;
    zip: string;
    floor?: string;
    intercom?: string;
    note?: string;
  };
  notes?: string;
  items: OrderItem[];
}

export interface Order {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  address: any;
  notes: string | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  created_at: string;
  items?: any[];
}

export interface CreateOrderResponse {
  order: Order;
}

export interface GetOrderResponse {
  order: Order;
}

export interface ListOrdersResponse {
  orders: Order[];
}

export interface PayOrderResponse {
  ok: boolean;
  message?: string;
}

/**
 * Create a new order
 */
export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
  // Map frontend fields to backend fields
  const backendPayload = {
    ...payload,
    delivery_address: {
      ...payload.address,
      postal_code: payload.address.zip,
    },
  };
  delete (backendPayload as any).address;
  delete (backendPayload as any).delivery_address.zip;

  const data = await httpClient.post<any>('/orders', backendPayload);

  // Normalize response
  let order: Order;
  if (data && data.data) {
    order = data.data;
  } else if (data && data.order) {
    order = data.order;
  } else {
    order = data;
  }

  return { order };
}

/**
 * Pay for an order (mock payment)
 */
export async function payOrder(orderId: string): Promise<PayOrderResponse> {
  const data = await httpClient.post<any>(`/orders/${orderId}/pay`);

  return {
    ok: data.ok ?? true,
    message: data.message,
  };
}

/**
 * Get order by ID
 */
export async function getOrder(orderId: string): Promise<GetOrderResponse> {
  const data = await httpClient.get<any>(`/orders/${orderId}`);

  // Normalize response
  let order: Order;
  if (data && data.data) {
    order = data.data;
  } else if (data && data.order) {
    order = data.order;
  } else {
    order = data;
  }

  return { order };
}

/**
 * List user's orders
 */
export async function listOrders(): Promise<ListOrdersResponse> {
  const data = await httpClient.get<any>('/orders');

  // Normalize response
  let orders: Order[];
  if (Array.isArray(data)) {
    orders = data;
  } else if (data && Array.isArray(data.data)) {
    orders = data.data;
  } else if (data && Array.isArray(data.orders)) {
    orders = data.orders;
  } else {
    orders = [];
  }

  return { orders };
}
