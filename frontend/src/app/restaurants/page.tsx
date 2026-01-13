'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { getRestaurants, type Restaurant } from '@/lib/api';

function RestaurantsPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [openOnly, setOpenOnly] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>('');

  // Safe array guard
  const safeRestaurants = Array.isArray(restaurants) ? restaurants : [];

  // Derived: available zones
  const zones = Array.from(
    new Set(safeRestaurants.map((r) => r.zone).filter(Boolean))
  ) as string[];

  useEffect(() => {
    async function fetchRestaurants() {
      setLoading(true);
      setError(null);

      try {
        const params: { open_now?: boolean; zone?: string } = {};

        if (openOnly) {
          params.open_now = true;
        }

        if (selectedZone) {
          params.zone = selectedZone;
        }

        const response = await getRestaurants(params);
        setRestaurants(response.restaurants);
      } catch (err) {
        setRestaurants([]);
        setError(err instanceof Error ? err.message : 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }

    fetchRestaurants();
  }, [openOnly, selectedZone]);

  function handleCardClick(slug: string) {
    router.push(`/restaurants/${slug}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Errore: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Ristoranti</h1>
          <p className="text-gray-600">Scegli il tuo ristorante preferito</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex flex-col space-y-3">
            {/* Checkbox: Solo aperti */}
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
                className="w-4 h-4"
                style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
              />
              <span className="text-sm font-medium">Solo aperti</span>
            </label>

            {/* Select: Zone */}
            {zones.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Zona:</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full"
                >
                  <option value="">Tutte le zone</option>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Restaurant List */}
        {safeRestaurants.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <p className="text-gray-600 text-center">Nessun ristorante disponibile</p>
          </div>
        ) : (
          <div className="space-y-3">
            {safeRestaurants.map((restaurant) => {
              const isOpen = restaurant.is_open ?? restaurant.status === 'active';

              return (
                <div
                  key={restaurant.id}
                  onClick={() => handleCardClick(restaurant.slug)}
                  className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:bg-gray-100 transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex flex-col space-y-2">
                    {/* Name */}
                    <h2 className="text-2xl font-semibold">{restaurant.name}</h2>

                    {/* Zone */}
                    {restaurant.zone && (
                      <p className="text-sm text-gray-600">Zona: {restaurant.zone}</p>
                    )}

                    {/* Status */}
                    <div>
                      {isOpen ? (
                        <span
                          className="inline-block px-2 py-1 text-xs rounded-full font-medium"
                          style={{
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                          }}
                        >
                          Aperto ora
                        </span>
                      ) : (
                        <span
                          className="inline-block px-2 py-1 text-xs rounded-full font-medium"
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                          }}
                        >
                          Chiuso
                        </span>
                      )}
                    </div>

                    {/* ETA */}
                    <p className="text-sm text-gray-600">
                      Consegna: {restaurant.eta_min}–{restaurant.eta_max} min
                    </p>

                    {/* Delivery Fee */}
                    <p className="text-sm text-gray-600">
                      Costo consegna: €{(restaurant.delivery_fee / 100).toFixed(2)}
                    </p>

                    {/* Min Order */}
                    <p className="text-sm text-gray-600">
                      Ordine minimo: €{(restaurant.min_order / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Restaurants() {
  return (
    <AuthGuard>
      <RestaurantsPage />
    </AuthGuard>
  );
}
