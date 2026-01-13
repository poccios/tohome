'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { useCart } from '@/lib/cart/CartContext';

function CartPage() {
  const router = useRouter();
  const { cart, isHydrated, removeItem, setQty, getTotals, clearCart } = useCart();
  const { subtotal_cents, total_items } = getTotals();

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Caricamento…</p>
      </div>
    );
  }

  // Show empty cart only after hydration
  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold mb-4">Carrello</h1>
          <p className="text-gray-600 mb-4">Il tuo carrello è vuoto</p>
          <Link
            href="/restaurants"
            className="inline-block px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Vedi Ristoranti
          </Link>
        </div>
      </div>
    );
  }

  function handleCheckout() {
    router.push('/checkout');
  }

  function handleClearCart() {
    if (confirm('Vuoi svuotare il carrello?')) {
      clearCart();
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Carrello</h1>
          <p className="text-gray-600">
            Ordine da: <span className="font-semibold">{cart.restaurant_name}</span>
          </p>
        </div>

        {/* Cart Items */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="space-y-4">
            {cart.items.map((item) => {
              const unitPrice =
                item.base_price_cents +
                item.options.reduce((sum, opt) => sum + opt.price_delta_cents, 0);

              return (
                <div
                  key={item.key}
                  className="border border-gray-200 rounded-md p-4 flex flex-col"
                >
                  {/* Item Name */}
                  <h3 className="font-semibold mb-2">{item.name}</h3>

                  {/* Options */}
                  {item.options.length > 0 && (
                    <div className="text-sm text-gray-600 mb-2">
                      {item.options.map((opt, idx) => (
                        <div key={idx}>
                          {opt.group_name}: {opt.item_name}
                          {opt.price_delta_cents > 0 && (
                            <span className="ml-1">
                              (+€{(opt.price_delta_cents / 100).toFixed(2)})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Price and Controls */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm">
                      <p className="font-medium">
                        €{(unitPrice / 100).toFixed(2)} × {item.qty}
                      </p>
                      <p className="text-gray-600">
                        Totale: €{(item.item_total_cents / 100).toFixed(2)}
                      </p>
                    </div>

                    {/* Qty Controls */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setQty(item.key, item.qty - 1)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
                      >
                        −
                      </button>
                      <span className="px-3 font-medium">{item.qty}</span>
                      <button
                        onClick={() => setQty(item.key, item.qty + 1)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors ml-2"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtotal */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Subtotale ({total_items} articoli):</span>
              <span className="text-2xl font-bold">
                €{(subtotal_cents / 100).toFixed(2)}
              </span>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Vai al Checkout
              </button>
              <button
                onClick={handleClearCart}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Svuota Carrello
              </button>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href={`/restaurants/${cart.restaurant_slug}`}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Continua a ordinare
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Cart() {
  return (
    <AuthGuard>
      <CartPage />
    </AuthGuard>
  );
}
