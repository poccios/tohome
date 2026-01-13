import { query, transaction } from '../db';

// ===== Type Definitions =====

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface MenuProduct {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price_cents: number;
  sort_order: number;
  is_active: boolean;
  allergens: string | null;
}

export interface ProductOptionGroup {
  id: string;
  restaurant_id: string;
  product_id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
}

export interface ProductOptionItem {
  id: string;
  restaurant_id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  is_active: boolean;
  sort_order: number;
}

export interface MenuProductWithOptions extends MenuProduct {
  option_groups: (ProductOptionGroup & { items: ProductOptionItem[] })[];
}

export interface MenuCategoryWithProducts extends MenuCategory {
  products: MenuProductWithOptions[];
}

export interface FullMenu {
  restaurant: {
    id: string;
    slug: string;
    name: string;
  };
  categories: MenuCategoryWithProducts[];
}

export interface CreateCategoryData {
  name: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateCategoryData {
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface CreateProductData {
  category_id: string;
  name: string;
  description?: string;
  image_url?: string;
  base_price_cents: number;
  sort_order?: number;
  is_active?: boolean;
  allergens?: string;
}

export interface UpdateProductData {
  category_id?: string;
  name?: string;
  description?: string;
  image_url?: string;
  base_price_cents?: number;
  sort_order?: number;
  is_active?: boolean;
  allergens?: string;
}

export interface SetProductOptionGroupData {
  name: string;
  min_select: number;
  max_select: number;
  sort_order?: number;
  items: {
    name: string;
    price_delta_cents: number;
    is_active?: boolean;
    sort_order?: number;
  }[];
}

// ===== Public Functions =====

/**
 * Get complete menu for a restaurant by slug
 * Returns categories with products and their option groups/items
 * Only includes active items
 */
export async function getMenuByRestaurantSlug(slug: string): Promise<FullMenu | null> {
  // First get the restaurant
  const restaurantResult = await query(
    'SELECT id, slug, name FROM restaurants WHERE slug = $1 AND is_active = true',
    [slug]
  );

  if (restaurantResult.rows.length === 0) {
    return null;
  }

  const restaurant = restaurantResult.rows[0];

  // Get categories with products
  const categoriesResult = await query<MenuCategory>(
    `SELECT id, restaurant_id, name, sort_order, is_active
     FROM menu_categories
     WHERE restaurant_id = $1 AND is_active = true
     ORDER BY sort_order ASC, name ASC`,
    [restaurant.id]
  );

  const categories: MenuCategoryWithProducts[] = [];

  for (const category of categoriesResult.rows) {
    // Get products for this category
    const productsResult = await query<MenuProduct>(
      `SELECT id, restaurant_id, category_id, name, description, image_url,
              base_price_cents, sort_order, is_active, allergens
       FROM menu_products
       WHERE category_id = $1 AND is_active = true
       ORDER BY sort_order ASC, name ASC`,
      [category.id]
    );

    const products: MenuProductWithOptions[] = [];

    for (const product of productsResult.rows) {
      // Get option groups for this product
      const groupsResult = await query<ProductOptionGroup>(
        `SELECT id, restaurant_id, product_id, name, min_select, max_select, sort_order
         FROM product_option_groups
         WHERE product_id = $1
         ORDER BY sort_order ASC, name ASC`,
        [product.id]
      );

      const optionGroups = [];

      for (const group of groupsResult.rows) {
        // Get items for this group
        const itemsResult = await query<ProductOptionItem>(
          `SELECT id, restaurant_id, group_id, name, price_delta_cents, is_active, sort_order
           FROM product_option_items
           WHERE group_id = $1 AND is_active = true
           ORDER BY sort_order ASC, name ASC`,
          [group.id]
        );

        optionGroups.push({
          ...group,
          items: itemsResult.rows,
        });
      }

      products.push({
        ...product,
        option_groups: optionGroups,
      });
    }

    categories.push({
      ...category,
      products,
    });
  }

  return {
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
    },
    categories,
  };
}

// ===== Admin Functions - Categories =====

/**
 * Create a new menu category
 */
export async function createCategory(
  restaurantId: string,
  data: CreateCategoryData
): Promise<MenuCategory> {
  const result = await query<MenuCategory>(
    `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      restaurantId,
      data.name,
      data.sort_order !== undefined ? data.sort_order : 0,
      data.is_active !== undefined ? data.is_active : true,
    ]
  );

  return result.rows[0];
}

/**
 * Update a menu category (partial update)
 */
export async function updateCategory(
  categoryId: string,
  patch: UpdateCategoryData
): Promise<MenuCategory | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (patch.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(patch.name);
  }
  if (patch.sort_order !== undefined) {
    fields.push(`sort_order = $${paramCount++}`);
    values.push(patch.sort_order);
  }
  if (patch.is_active !== undefined) {
    fields.push(`is_active = $${paramCount++}`);
    values.push(patch.is_active);
  }

  if (fields.length === 0) {
    const result = await query<MenuCategory>(
      'SELECT * FROM menu_categories WHERE id = $1',
      [categoryId]
    );
    return result.rows[0] || null;
  }

  values.push(categoryId);
  const queryText = `
    UPDATE menu_categories
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await query<MenuCategory>(queryText, values);
  return result.rows[0] || null;
}

/**
 * Delete a category (only if no active products exist in it)
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  await transaction(async (client) => {
    // Check if category has active products
    const productsCheck = await client.query(
      'SELECT id FROM menu_products WHERE category_id = $1 AND is_active = true LIMIT 1',
      [categoryId]
    );

    if (productsCheck.rows.length > 0) {
      throw new Error('Cannot delete category with active products');
    }

    // Soft delete the category
    await client.query(
      'UPDATE menu_categories SET is_active = false WHERE id = $1',
      [categoryId]
    );
  });
}

// ===== Admin Functions - Products =====

/**
 * Create a new menu product
 */
export async function createProduct(
  restaurantId: string,
  data: CreateProductData
): Promise<MenuProduct> {
  const result = await query<MenuProduct>(
    `INSERT INTO menu_products (
      restaurant_id, category_id, name, description, image_url,
      base_price_cents, sort_order, is_active, allergens
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      restaurantId,
      data.category_id,
      data.name,
      data.description || null,
      data.image_url || null,
      data.base_price_cents,
      data.sort_order !== undefined ? data.sort_order : 0,
      data.is_active !== undefined ? data.is_active : true,
      data.allergens || null,
    ]
  );

  return result.rows[0];
}

/**
 * Update a menu product (partial update)
 */
export async function updateProduct(
  productId: string,
  patch: UpdateProductData
): Promise<MenuProduct | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (patch.category_id !== undefined) {
    fields.push(`category_id = $${paramCount++}`);
    values.push(patch.category_id);
  }
  if (patch.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(patch.description);
  }
  if (patch.image_url !== undefined) {
    fields.push(`image_url = $${paramCount++}`);
    values.push(patch.image_url);
  }
  if (patch.base_price_cents !== undefined) {
    fields.push(`base_price_cents = $${paramCount++}`);
    values.push(patch.base_price_cents);
  }
  if (patch.sort_order !== undefined) {
    fields.push(`sort_order = $${paramCount++}`);
    values.push(patch.sort_order);
  }
  if (patch.is_active !== undefined) {
    fields.push(`is_active = $${paramCount++}`);
    values.push(patch.is_active);
  }
  if (patch.allergens !== undefined) {
    fields.push(`allergens = $${paramCount++}`);
    values.push(patch.allergens);
  }

  if (fields.length === 0) {
    const result = await query<MenuProduct>(
      'SELECT * FROM menu_products WHERE id = $1',
      [productId]
    );
    return result.rows[0] || null;
  }

  values.push(productId);
  const queryText = `
    UPDATE menu_products
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await query<MenuProduct>(queryText, values);
  return result.rows[0] || null;
}

/**
 * Soft delete a product
 */
export async function softDeleteProduct(productId: string): Promise<void> {
  await query(
    'UPDATE menu_products SET is_active = false WHERE id = $1',
    [productId]
  );
}

// ===== Admin Functions - Product Options =====

/**
 * Replace all option groups and items for a product (atomic transaction)
 */
export async function setProductOptionGroups(
  productId: string,
  groups: SetProductOptionGroupData[]
): Promise<void> {
  await transaction(async (client) => {
    // Get restaurant_id from product
    const productResult = await client.query(
      'SELECT restaurant_id FROM menu_products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }

    const restaurantId = productResult.rows[0].restaurant_id;

    // Delete all existing option groups (cascade will delete items)
    await client.query(
      'DELETE FROM product_option_groups WHERE product_id = $1',
      [productId]
    );

    // Insert new option groups and their items
    for (const group of groups) {
      // Insert option group
      const groupResult = await client.query(
        `INSERT INTO product_option_groups (
          restaurant_id, product_id, name, min_select, max_select, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          restaurantId,
          productId,
          group.name,
          group.min_select,
          group.max_select,
          group.sort_order !== undefined ? group.sort_order : 0,
        ]
      );

      const groupId = groupResult.rows[0].id;

      // Insert option items for this group
      for (const item of group.items) {
        await client.query(
          `INSERT INTO product_option_items (
            restaurant_id, group_id, name, price_delta_cents, is_active, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            restaurantId,
            groupId,
            item.name,
            item.price_delta_cents,
            item.is_active !== undefined ? item.is_active : true,
            item.sort_order !== undefined ? item.sort_order : 0,
          ]
        );
      }
    }
  });
}
