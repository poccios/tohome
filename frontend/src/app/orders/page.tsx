'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { listOrders, type Order } from '@/lib/api';

function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    setError(null);

    try {
      const response = await listOrders();
      // Sort by created_at descending (most recent first)
      const sorted = response.orders.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getShortId(id: string): string {
    return id.substring(0, 8);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Caricamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <p className="text-gray-600">Errore: {error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold mb-4">I Miei Ordini</h1>
          <p className="text-gray-600 mb-4">Non hai ancora effettuato ordini</p>
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

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">I Miei Ordini</h1>
          <p className="text-gray-600">Storico dei tuoi ordini</p>
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => router.push(`/orders/${order.id}`)}
              className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:bg-gray-100 transition-colors"
              style={{ cursor: 'pointer' }}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">Ordine #{getShortId(order.id)}</h3>
                  <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">€{(order.total_cents / 100).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                {/* Status */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Stato:</span>
                  <span
                    className="inline-block px-2 py-1 text-xs rounded-full font-medium"
                    style={{
                      backgroundColor: order.status === 'delivered' ? '#dcfce7' : '#e0e7ff',
                      color: order.status === 'delivered' ? '#166534' : '#3730a3',
                    }}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Payment */}
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Pagamento:</span> {order.payment_method} (
                  {order.payment_status})
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  return (
    <AuthGuard>
      <OrdersPage />
    </AuthGuard>
  );
}
