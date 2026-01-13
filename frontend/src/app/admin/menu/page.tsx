/**
 * Admin Menu Page - Restaurant Selection
 * Select a restaurant to manage its menu
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
  is_active: boolean;
}

function MenuPage() {
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

  const handleSelectRestaurant = (restaurantId: string) => {
    router.push(`/admin/menu/${restaurantId}`);
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
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>
            Gestione Menu
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
            Seleziona un ristorante per gestire il suo menu
          </p>
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
            <p style={{ color: '#6b7280' }}>Nessun ristorante trovato</p>
          </div>
        )}

        {!loading && !error && restaurants.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                onClick={() => handleSelectRestaurant(restaurant.id)}
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {restaurant.name}
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  {restaurant.slug}
                </p>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '9999px',
                    backgroundColor: restaurant.is_active ? '#dcfce7' : '#fee2e2',
                    color: restaurant.is_active ? '#166534' : '#991b1b',
                  }}
                >
                  {restaurant.is_active ? 'Attivo' : 'Disattivato'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMenuPage() {
  return (
    <AdminGuard>
      <MenuPage />
    </AdminGuard>
  );
}
