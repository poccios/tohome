'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { getOrder, type Order } from '@/lib/api';

// Simple status timeline
const STATUS_TIMELINE = [
  { key: 'pending', label: 'In attesa' },
  { key: 'confirmed', label: 'Confermato' },
  { key: 'preparing', label: 'In preparazione' },
  { key: 'ready', label: 'Pronto' },
  { key: 'delivering', label: 'In consegna' },
  { key: 'delivered', label: 'Consegnato' },
];

function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
    setLoading(true);
    setError(null);

    try {
      const response = await getOrder(orderId);
      setOrder(response.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }

  function getShortId(id: string): string {
    return id.substring(0, 8);
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

  function getCurrentStatusIndex(status: string): number {
    return STATUS_TIMELINE.findIndex((s) => s.key === status);
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
            onClick={fetchOrder}
            className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Ordine non trovato</p>
      </div>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex(order.status);

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Ordine #{getShortId(order.id)}</h1>
          <p className="text-gray-600">{formatDate(order.created_at)}</p>
        </div>

        {/* Status Badge */}
        <div className="text-center">
          <span
            className="inline-block px-4 py-2 text-lg rounded-full font-semibold"
            style={{
              backgroundColor: order.status === 'delivered' ? '#dcfce7' : '#e0e7ff',
              color: order.status === 'delivered' ? '#166534' : '#3730a3',
            }}
          >
            {order.status}
          </span>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-4">Tracking</h2>
          <div className="space-y-2">
            {STATUS_TIMELINE.map((status, index) => {
              const isActive = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;

              return (
                <div
                  key={status.key}
                  className="flex items-center space-x-2"
                  style={{
                    opacity: isActive ? 1 : 0.4,
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: isActive ? '#2563eb' : '#d1d5db',
                    }}
                  />
                  <span
                    className="text-sm"
                    style={{
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-4">Indirizzo di consegna</h2>
          <div className="text-sm text-gray-600 space-y-1">
            {order.address && typeof order.address === 'object' ? (
              <>
                <p>
                  {order.address.street} {order.address.number}
                </p>
                <p>
                  {order.address.city}, {order.address.zip}
                </p>
                {order.address.floor && <p>Piano: {order.address.floor}</p>}
                {order.address.intercom && <p>Citofono: {order.address.intercom}</p>}
                {order.address.note && <p>Note: {order.address.note}</p>}
              </>
            ) : (
              <p className="text-gray-600">Indirizzo non disponibile</p>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-4">Articoli</h2>

          {order.items && order.items.length > 0 ? (
            <div className="space-y-3">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-md p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">
                        {item.name || item.product_name || 'Prodotto'}
                      </h3>
                      <p className="text-sm text-gray-600">Quantità: {item.qty || 1}</p>
                    </div>
                    {item.item_total_cents && (
                      <p className="font-medium">€{(item.item_total_cents / 100).toFixed(2)}</p>
                    )}
                  </div>

                  {/* Options */}
                  {item.options && item.options.length > 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                      {item.options.map((opt: any, optIdx: number) => (
                        <div key={optIdx}>
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
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Nessun articolo disponibile</p>
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-4">Riepilogo</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotale:</span>
              <span className="font-medium">€{(order.subtotal_cents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Costo consegna:</span>
              <span className="font-medium">€{(order.delivery_fee_cents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold">Totale:</span>
              <span className="font-bold text-lg">€{(order.total_cents / 100).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              <span className="font-medium">Metodo di pagamento:</span> {order.payment_method}
            </p>
            <p>
              <span className="font-medium">Stato pagamento:</span> {order.payment_status}
            </p>
          </div>

          {order.notes && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md">
              <p className="text-sm font-medium mb-1">Note:</p>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="text-center">
          <Link
            href="/restaurants"
            className="inline-block px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Torna ai Ristoranti
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  return (
    <AuthGuard>
      <OrderDetailPage />
    </AuthGuard>
  );
}
