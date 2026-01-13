'use client';

import Link from 'next/link';
import { AuthGuard, useUser } from '@/components/auth-guard';
import { useCart } from '@/lib/cart/CartContext';

function HomePage() {
  const { user, loading } = useUser();
  const { getTotals } = useCart();
  const { total_items } = getTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // AuthGuard will redirect
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">ToHome</h1>
          <p className="text-gray-600">Ordina dal tuo ristorante preferito</p>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-4">
            Ciao {user.email || user.name || user.phone}! 👋
          </h2>

          <div className="space-y-2 text-sm text-gray-600">
            {user.email && (
              <p>
                <span className="font-medium">Email:</span> {user.email}
              </p>
            )}
            {user.phone && (
              <p>
                <span className="font-medium">Phone:</span> {user.phone}
              </p>
            )}
            {user.name && (
              <p>
                <span className="font-medium">Name:</span> {user.name}
              </p>
            )}
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                {user.status}
              </span>
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Esplora</h3>
          <div className="space-y-3">
            <Link
              href="/restaurants"
              className="block w-full px-4 py-3 text-center bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Vedi Ristoranti
            </Link>
            <Link
              href="/cart"
              className="block w-full px-4 py-3 text-center bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
            >
              Carrello {total_items > 0 && `(${total_items})`}
            </Link>
            <Link
              href="/orders"
              className="block w-full px-4 py-3 text-center bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
            >
              I Miei Ordini
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Benvenuto su ToHome - Il tuo cibo preferito a casa tua</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomePage />
    </AuthGuard>
  );
}
