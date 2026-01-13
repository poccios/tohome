import { Pool, PoolClient } from 'pg';
import { pool, query } from '../db';
import * as restaurantsRepo from './restaurantsRepo';
import * as menuRepo from './menuRepo';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type OrderStatus =
  | 'CREATED'
  | 'PAID'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentMethod = 'ONLINE' | 'CASH';
export type PaymentStatus = 'PENDING' | 'PAID';

export interface Order {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal_cents: number;
  delivery_fee_cents: number;
  service_fee_cents: number;
  total_cents: number;
  address_json: any;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit_price_cents: number;
  qty: number;
  total_cents: number;
}

export interface OrderItemOption {
  id: string;
  order_item_id: string;
  group_name: string;
  item_name: string;
  price_delta_cents: number;
}

export interface CartItemOption {
  group_id: string;
  item_id: string;
}

export interface CartItem {
  product_id: string;
  qty: number;
  options: CartItemOption[];
}

export interface DeliveryAddress {
  street: string;
  city: string;
  postal_code: string;
  notes?: string;
}

export interface CreateOrderInput {
  user_id: string;
  restaurant_id: string;
  payment_method: PaymentMethod;
  delivery_address: DeliveryAddress;
  items: CartItem[];
  notes?: string;
}

export interface OrderItemWithOptions extends OrderItem {
  options: OrderItemOption[];
}

export interface FullOrder extends Order {
  items: OrderItemWithOptions[];
}

// ============================================================================
// Validation and Helper Functions
// ============================================================================

async function validateRestaurantOpenAndActive(
  restaurantId: string,
  client: PoolClient
): Promise<void> {
  // Check if restaurant exists and is active
  const restaurantResult = await client.query(
    'SELECT id, is_active FROM restaurants WHERE id = $1',
    [restaurantId]
  );

  if (restaurantResult.rows.length === 0) {
    throw new Error('RESTAURANT_NOT_FOUND');
  }

  if (!restaurantResult.rows[0].is_active) {
    throw new Error('RESTAURANT_NOT_ACTIVE');
  }

  // Check if restaurant is open now
  // TODO: Implement proper open/closed check using restaurant hours
  // For now, we'll assume restaurants are always open if they have hours
  const hoursResult = await client.query(
    'SELECT COUNT(*) as count FROM restaurant_hours WHERE restaurant_id = $1',
    [restaurantId]
  );
  const hasHours = parseInt(hoursResult.rows[0].count) > 0;
  if (!hasHours) {
    throw new Error('RESTAURANT_CLOSED');
  }
}

async function validateAndCalculateOrder(
  input: CreateOrderInput,
  client: PoolClient
): Promise<{
  subtotal_cents: number;
  items: Array<{
    product_id: string;
    name: string;
    unit_price_cents: number;
    qty: number;
    total_cents: number;
    options: Array<{
      group_name: string;
      item_name: string;
      price_delta_cents: number;
    }>;
  }>;
}> {
  if (input.items.length === 0) {
    throw new Error('CART_EMPTY');
  }

  const itemsWithSnapshots: Array<{
    product_id: string;
    name: string;
    unit_price_cents: number;
    qty: number;
    total_cents: number;
    options: Array<{
      group_name: string;
      item_name: string;
      price_delta_cents: number;
    }>;
  }> = [];

  let subtotal = 0;

  for (const cartItem of input.items) {
    // Get product details
    const productResult = await client.query(
      `SELECT id, name, base_price_cents, is_active, category_id
       FROM menu_products
       WHERE id = $1 AND restaurant_id = $2`,
      [cartItem.product_id, input.restaurant_id]
    );

    if (productResult.rows.length === 0) {
      throw new Error(`PRODUCT_NOT_FOUND:${cartItem.product_id}`);
    }

    const product = productResult.rows[0];
    if (!product.is_active) {
      throw new Error(`PRODUCT_NOT_ACTIVE:${product.name}`);
    }

    // Get option groups for this product
    const groupsResult = await client.query(
      `SELECT id, name, min_select, max_select
       FROM product_option_groups
       WHERE product_id = $1
       ORDER BY sort_order ASC`,
      [cartItem.product_id]
    );

    const optionGroups = groupsResult.rows;

    // Validate option selections
    const selectedOptionsByGroup = new Map<string, CartItemOption[]>();
    for (const opt of cartItem.options) {
      if (!selectedOptionsByGroup.has(opt.group_id)) {
        selectedOptionsByGroup.set(opt.group_id, []);
      }
      selectedOptionsByGroup.get(opt.group_id)!.push(opt);
    }

    // Check min/max constraints
    for (const group of optionGroups) {
      const selectedCount = selectedOptionsByGroup.get(group.id)?.length || 0;
      if (selectedCount < group.min_select) {
        throw new Error(
          `OPTION_MIN_NOT_MET:${group.name} requires at least ${group.min_select} selection(s)`
        );
      }
      if (selectedCount > group.max_select) {
        throw new Error(
          `OPTION_MAX_EXCEEDED:${group.name} allows at most ${group.max_select} selection(s)`
        );
      }
    }

    // Calculate item price with options
    let itemPrice = product.base_price_cents;
    const optionSnapshots: Array<{
      group_name: string;
      item_name: string;
      price_delta_cents: number;
    }> = [];

    for (const opt of cartItem.options) {
      const optionResult = await client.query(
        `SELECT poi.id, poi.name, poi.price_delta_cents, poi.is_active, pog.name as group_name
         FROM product_option_items poi
         JOIN product_option_groups pog ON poi.group_id = pog.id
         WHERE poi.id = $1 AND poi.group_id = $2 AND poi.restaurant_id = $3`,
        [opt.item_id, opt.group_id, input.restaurant_id]
      );

      if (optionResult.rows.length === 0) {
        throw new Error(`OPTION_NOT_FOUND:${opt.item_id}`);
      }

      const option = optionResult.rows[0];
      if (!option.is_active) {
        throw new Error(`OPTION_NOT_ACTIVE:${option.name}`);
      }

      itemPrice += option.price_delta_cents;
      optionSnapshots.push({
        group_name: option.group_name,
        item_name: option.name,
        price_delta_cents: option.price_delta_cents,
      });
    }

    const itemTotal = itemPrice * cartItem.qty;
    subtotal += itemTotal;

    itemsWithSnapshots.push({
      product_id: cartItem.product_id,
      name: product.name,
      unit_price_cents: itemPrice,
      qty: cartItem.qty,
      total_cents: itemTotal,
      options: optionSnapshots,
    });
  }

  // Check minimum order amount
  const deliveryRulesResult = await client.query(
    `SELECT min_order_cents FROM restaurant_delivery_rules WHERE restaurant_id = $1`,
    [input.restaurant_id]
  );
  if (deliveryRulesResult.rows.length > 0) {
    const minOrderCents = deliveryRulesResult.rows[0].min_order_cents;
    if (minOrderCents && subtotal < minOrderCents) {
      throw new Error(`MIN_ORDER_NOT_MET:Minimum order is ${minOrderCents} cents`);
    }
  }

  return {
    subtotal_cents: subtotal,
    items: itemsWithSnapshots,
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

export async function createOrder(input: CreateOrderInput): Promise<FullOrder> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate restaurant is open and active
    await validateRestaurantOpenAndActive(input.restaurant_id, client);

    // Validate items and calculate totals
    const { subtotal_cents, items } = await validateAndCalculateOrder(input, client);

    // Calculate fees (can be extended with actual logic)
    const delivery_fee_cents = 0; // TODO: Implement delivery fee calculation
    const service_fee_cents = 0; // TODO: Implement service fee calculation
    const total_cents = subtotal_cents + delivery_fee_cents + service_fee_cents;

    // Determine initial status and payment_status based on payment method
    let status: OrderStatus = 'CREATED';
    let payment_status: PaymentStatus = 'PENDING';

    if (input.payment_method === 'CASH') {
      // Auto-accept CASH orders
      status = 'ACCEPTED';
      payment_status = 'PAID';
    }

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (
        user_id, restaurant_id, status, payment_method, payment_status,
        subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents,
        address_json, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.user_id,
        input.restaurant_id,
        status,
        input.payment_method,
        payment_status,
        subtotal_cents,
        delivery_fee_cents,
        service_fee_cents,
        total_cents,
        JSON.stringify(input.delivery_address),
        input.notes || null,
      ]
    );

    const order = orderResult.rows[0];

    // Create order items
    const orderItems: OrderItemWithOptions[] = [];
    for (const item of items) {
      const itemResult = await client.query(
        `INSERT INTO order_items (
          order_id, product_id, name, unit_price_cents, qty, total_cents
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [order.id, item.product_id, item.name, item.unit_price_cents, item.qty, item.total_cents]
      );

      const orderItem = itemResult.rows[0];
      const orderItemOptions: OrderItemOption[] = [];

      // Create order item options
      for (const option of item.options) {
        const optionResult = await client.query(
          `INSERT INTO order_item_options (
            order_item_id, group_name, item_name, price_delta_cents
          ) VALUES ($1, $2, $3, $4)
          RETURNING *`,
          [orderItem.id, option.group_name, option.item_name, option.price_delta_cents]
        );
        orderItemOptions.push(optionResult.rows[0]);
      }

      orderItems.push({
        ...orderItem,
        options: orderItemOptions,
      });
    }

    await client.query('COMMIT');

    return {
      ...order,
      items: orderItems,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrderById(
  orderId: string,
  userId?: string
): Promise<FullOrder | null> {
  const orderResult = await query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId]
  );

  if (orderResult.rows.length === 0) {
    return null;
  }

  const order = orderResult.rows[0];

  // If userId is provided, check ownership
  if (userId && order.user_id !== userId) {
    return null;
  }

  // Get order items
  const itemsResult = await query(
    'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id',
    [orderId]
  );

  const items: OrderItemWithOptions[] = [];
  for (const item of itemsResult.rows) {
    const optionsResult = await query(
      'SELECT * FROM order_item_options WHERE order_item_id = $1 ORDER BY id',
      [item.id]
    );

    items.push({
      ...item,
      options: optionsResult.rows,
    });
  }

  return {
    ...order,
    items,
  };
}

export async function listOrdersByUser(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<FullOrder[]> {
  const ordersResult = await query(
    `SELECT * FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const orders: FullOrder[] = [];
  for (const order of ordersResult.rows) {
    const fullOrder = await getOrderById(order.id);
    if (fullOrder) {
      orders.push(fullOrder);
    }
  }

  return orders;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<Order | null> {
  const result = await query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [newStatus, orderId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
  newStatus?: OrderStatus
): Promise<Order | null> {
  const updateFields = ['payment_status = $1', 'updated_at = NOW()'];
  const values = [paymentStatus];
  let paramIndex = 2;

  if (newStatus) {
    updateFields.push(`status = $${paramIndex}`);
    values.push(newStatus);
    paramIndex++;
  }

  values.push(orderId);

  const result = await query(
    `UPDATE orders
     SET ${updateFields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}
