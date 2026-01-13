'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { useCart } from '@/lib/cart/CartContext';
import { createOrder, payOrder, type CreateOrderPayload, type Order } from '@/lib/api';

type PaymentMethod = 'CASH' | 'ONLINE';

interface PaymentScreenState {
  order: Order;
}

function CheckoutPage() {
  const router = useRouter();
  const { cart, isHydrated, getTotals, clearCart } = useCart();
  const { subtotal_cents, total_items } = getTotals();

  // Redirect if cart empty (only after hydration)
  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration

    if (!cart || cart.items.length === 0) {
      router.push('/cart');
    }
  }, [cart, isHydrated, router]);

  // Form state
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [floor, setFloor] = useState('');
  const [intercom, setIntercom] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentScreen, setPaymentScreen] = useState<PaymentScreenState | null>(null);
  const [paying, setPaying] = useState(false);

  if (!cart || cart.items.length === 0) {
    return null; // Will redirect
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build payload
      const payload: CreateOrderPayload = {
        restaurant_id: cart.restaurant_id,
        payment_method: paymentMethod,
        address: {
          street,
          number,
          city,
          zip,
          ...(floor && { floor }),
          ...(intercom && { intercom }),
          ...(addressNote && { note: addressNote }),
        },
        ...(orderNotes && { notes: orderNotes }),
        items: cart.items.map((item) => ({
          product_id: item.product_id,
          qty: item.qty,
          options: item.options.map((opt) => ({
            group_id: opt.group_id,
            item_id: opt.item_id,
          })),
        })),
      };

      const response = await createOrder(payload);

      // Handle based on payment method
      if (paymentMethod === 'CASH') {
        // Redirect to order page (cart will be cleared there)
        router.push(`/orders/${response.order.id}`);
      } else {
        // Show payment screen
        setPaymentScreen({ order: response.order });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella creazione ordine');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayNow() {
    if (!paymentScreen) return;

    setPaying(true);
    setError(null);

    try {
      await payOrder(paymentScreen.order.id);
      router.push(`/orders/${paymentScreen.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel pagamento');
    } finally {
      setPaying(false);
    }
  }

  // Payment screen
  if (paymentScreen) {
    return (
      <div className="flex flex-col items-center min-h-screen p-8">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Ordine Creato</h1>
            <p className="text-gray-600">Il tuo ordine è stato creato con successo</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4">Riepilogo</h2>

            <div className="space-y-2 text-sm text-gray-600 mb-6">
              <p>
                <span className="font-medium">Ordine #:</span> {paymentScreen.order.id}
              </p>
              <p>
                <span className="font-medium">Ristorante:</span> {cart.restaurant_name}
              </p>
              <p>
                <span className="font-medium">Totale:</span> €
                {(paymentScreen.order.total_cents / 100).toFixed(2)}
              </p>
              <p>
                <span className="font-medium">Stato pagamento:</span>{' '}
                {paymentScreen.order.payment_status}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-gray-100 rounded-md">
                <p className="text-sm text-gray-700">Errore: {error}</p>
              </div>
            )}

            <button
              onClick={handlePayNow}
              disabled={paying}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              {paying ? 'Elaborazione...' : 'Paga ora (mock)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Checkout form
  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Checkout</h1>
          <p className="text-gray-600">Completa il tuo ordine</p>
        </div>

        <div className="flex flex-col space-y-8">
          {/* Cart Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4">
              Ordine da {cart.restaurant_name}
            </h2>

            <div className="space-y-2 mb-4">
              {cart.items.map((item) => (
                <div key={item.key} className="flex justify-between text-sm">
                  <span>
                    {item.name} × {item.qty}
                    {item.options.length > 0 && (
                      <span className="text-gray-600 text-xs ml-1">
                        ({item.options.map((o) => o.item_name).join(', ')})
                      </span>
                    )}
                  </span>
                  <span className="font-medium">
                    €{(item.item_total_cents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between font-semibold">
                <span>Subtotale ({total_items} articoli):</span>
                <span>€{(subtotal_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Indirizzo di consegna</h3>

            <div className="space-y-3 mb-6">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Via *</label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label className="block text-sm font-medium mb-1">Num *</label>
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Città *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <label className="block text-sm font-medium mb-1">CAP *</label>
                  <input
                    type="text"
                    required
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Piano (opz)</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Citofono (opz)</label>
                  <input
                    type="text"
                    value={intercom}
                    onChange={(e) => setIntercom(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Note indirizzo (opz)</label>
                <input
                  type="text"
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                  className="w-full"
                  placeholder="Es: scala B, secondo piano"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Note ordine (opz)</label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full"
                rows={3}
                placeholder="Eventuali richieste speciali"
              />
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Metodo di pagamento</h3>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-gray-200 rounded-md">
                  <input
                    type="radio"
                    name="payment"
                    value="CASH"
                    checked={paymentMethod === 'CASH'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mr-2"
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  <span className="font-medium">Contanti alla consegna</span>
                </label>
                <label className="flex items-center p-3 border border-gray-200 rounded-md">
                  <input
                    type="radio"
                    name="payment"
                    value="ONLINE"
                    checked={paymentMethod === 'ONLINE'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mr-2"
                    style={{ width: '1rem', height: '1rem' }}
                  />
                  <span className="font-medium">Pagamento online (mock)</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-gray-100 rounded-md">
                <p className="text-sm text-gray-700">Errore: {error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              {loading ? 'Elaborazione...' : 'Conferma Ordine'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Checkout() {
  return (
    <AuthGuard>
      <CheckoutPage />
    </AuthGuard>
  );
}
