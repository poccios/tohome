/**
 * Admin Restaurants Page - List
 * Shows all restaurants with link to create new or edit existing
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/admin-guard';
import { adminHttp, AdminHttpError } from '@/lib/adminHttp';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  is_active: boolean;
}

function RestaurantsListPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    setLoading(true);
    setError('');

    try {
      // Use public GET /restaurants endpoint (includes id)
      const response = await adminHttp.get<any>('/restaurants');

      // Normalize response
      let restaurantsList: Restaurant[];
      if (Array.isArray(response)) {
        restaurantsList = response;
      } else if (response.restaurants) {
        restaurantsList = response.restaurants;
      } else if (response.data) {
        restaurantsList = response.data;
      } else {
        restaurantsList = [];
      }

      setRestaurants(restaurantsList);
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nel caricamento ristoranti');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '1rem 2rem',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <a
            href="/admin"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              display: 'inline-block',
            }}
          >
            ← Torna alla dashboard
          </a>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>
                Gestione Ristoranti
              </h1>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
                Crea, modifica e gestisci i ristoranti
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/restaurants/new')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.95rem',
              }}
            >
              + Nuovo Ristorante
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#6b7280' }}>Caricamento ristoranti...</p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && restaurants.length === 0 && (
          <div
            style={{
              padding: '3rem',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Nessun ristorante trovato. Creane uno per iniziare!
            </p>
            <button
              onClick={() => router.push('/admin/restaurants/new')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              + Nuovo Ristorante
            </button>
          </div>
        )}

        {!loading && !error && restaurants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                onClick={() => router.push(`/admin/restaurants/${restaurant.id}`)}
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                      {restaurant.name}
                    </h3>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.75rem',
                        borderRadius: '9999px',
                        backgroundColor: restaurant.is_active ? '#dcfce7' : '#fee2e2',
                        color: restaurant.is_active ? '#166534' : '#991b1b',
                      }}
                    >
                      {restaurant.is_active ? 'Attivo' : 'Disattivato'}
                    </span>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                    Slug: {restaurant.slug}
                  </p>
                  {restaurant.address && (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                      📍 {restaurant.address}
                    </p>
                  )}
                  {restaurant.phone && (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                      📞 {restaurant.phone}
                    </p>
                  )}
                </div>
                <div style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 500 }}>
                  Modifica →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminRestaurantsPage() {
  return (
    <AdminGuard>
      <RestaurantsListPage />
    </AdminGuard>
  );
}
