'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CartState, CartItem, CartOption, CartTotals } from '../cartTypes';

interface CartContextValue {
  cart: CartState | null;
  isHydrated: boolean;
  addItem: (
    restaurant: { id: string; slug: string; name: string },
    product: { id: string; name: string; base_price_cents: number },
    options: CartOption[],
    qty: number
  ) => void;
  removeItem: (itemKey: string) => void;
  setQty: (itemKey: string, qty: number) => void;
  clearCart: () => void;
  getTotals: () => CartTotals;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = 'tohome_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCart(parsed);
      } catch (err) {
        console.error('Failed to parse cart from localStorage', err);
      }
    }
    // Always set hydrated to true after loading (even if nothing in storage)
    setIsHydrated(true);
  }, []);

  // Save cart to localStorage on change (only if hydrated)
  useEffect(() => {
    if (!isHydrated) return; // Don't persist until hydrated

    if (cart) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [cart, isHydrated]);

  function generateItemKey(productId: string, options: CartOption[]): string {
    const sortedOptions = [...options].sort((a, b) =>
      a.item_id.localeCompare(b.item_id)
    );
    const optionsStr = sortedOptions.map((o) => o.item_id).join('|');
    return `${productId}::${optionsStr}`;
  }

  function calculateItemTotal(
    base_price_cents: number,
    options: CartOption[],
    qty: number
  ): number {
    const optionsTotal = options.reduce((sum, opt) => sum + opt.price_delta_cents, 0);
    return (base_price_cents + optionsTotal) * qty;
  }

  function addItem(
    restaurant: { id: string; slug: string; name: string },
    product: { id: string; name: string; base_price_cents: number },
    options: CartOption[],
    qty: number
  ) {
    // Check if switching restaurant
    if (cart && cart.restaurant_id !== restaurant.id) {
      const confirmSwitch = confirm(
        `Vuoi svuotare il carrello e cambiare ristorante?\n\nAttuale: ${cart.restaurant_name}\nNuovo: ${restaurant.name}`
      );

      if (!confirmSwitch) {
        return;
      }

      // Clear cart and start fresh
      setCart({
        restaurant_id: restaurant.id,
        restaurant_slug: restaurant.slug,
        restaurant_name: restaurant.name,
        items: [],
      });
    }

    const key = generateItemKey(product.id, options);
    const item_total_cents = calculateItemTotal(product.base_price_cents, options, qty);

    const newItem: CartItem = {
      key,
      product_id: product.id,
      name: product.name,
      base_price_cents: product.base_price_cents,
      qty,
      options,
      item_total_cents,
    };

    setCart((prev) => {
      if (!prev) {
        // First item
        return {
          restaurant_id: restaurant.id,
          restaurant_slug: restaurant.slug,
          restaurant_name: restaurant.name,
          items: [newItem],
        };
      }

      // Check if item with same key exists
      const existingIndex = prev.items.findIndex((item) => item.key === key);

      if (existingIndex >= 0) {
        // Update qty
        const updatedItems = [...prev.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          qty: updatedItems[existingIndex].qty + qty,
          item_total_cents: calculateItemTotal(
            product.base_price_cents,
            options,
            updatedItems[existingIndex].qty + qty
          ),
        };

        return {
          ...prev,
          items: updatedItems,
        };
      } else {
        // Add new item
        return {
          ...prev,
          items: [...prev.items, newItem],
        };
      }
    });
  }

  function removeItem(itemKey: string) {
    setCart((prev) => {
      if (!prev) return null;

      const filteredItems = prev.items.filter((item) => item.key !== itemKey);

      if (filteredItems.length === 0) {
        return null; // Clear cart if empty
      }

      return {
        ...prev,
        items: filteredItems,
      };
    });
  }

  function setQty(itemKey: string, qty: number) {
    if (qty < 1) {
      removeItem(itemKey);
      return;
    }

    setCart((prev) => {
      if (!prev) return null;

      const updatedItems = prev.items.map((item) => {
        if (item.key === itemKey) {
          return {
            ...item,
            qty,
            item_total_cents: calculateItemTotal(item.base_price_cents, item.options, qty),
          };
        }
        return item;
      });

      return {
        ...prev,
        items: updatedItems,
      };
    });
  }

  function clearCart() {
    setCart(null);
  }

  function getTotals(): CartTotals {
    if (!cart) {
      return {
        subtotal_cents: 0,
        total_items: 0,
      };
    }

    const subtotal_cents = cart.items.reduce((sum, item) => sum + item.item_total_cents, 0);
    const total_items = cart.items.reduce((sum, item) => sum + item.qty, 0);

    return {
      subtotal_cents,
      total_items,
    };
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        isHydrated,
        addItem,
        removeItem,
        setQty,
        clearCart,
        getTotals,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
