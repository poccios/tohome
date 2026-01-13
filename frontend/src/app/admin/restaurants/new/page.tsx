/**
 * Admin New Restaurant Page
 * Create new restaurant
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/admin-guard';
import { adminHttp, AdminHttpError } from '@/lib/adminHttp';

function NewRestaurantPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    address: '',
    phone: '',
    latitude: '',
    longitude: '',
    is_active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        is_active: form.is_active,
      };

      const response = await adminHttp.post<any>('/admin/restaurants', payload);

      // Extract restaurant ID from response
      let restaurantId: string;
      if (response.restaurant?.id) {
        restaurantId = response.restaurant.id;
      } else if (response.id) {
        restaurantId = response.id;
      } else if (response.data?.id) {
        restaurantId = response.data.id;
      } else {
        // Fallback: redirect to list
        router.push('/admin/restaurants');
        return;
      }

      // Redirect to edit page
      router.push(`/admin/restaurants/${restaurantId}`);
    } catch (err) {
      if (err instanceof AdminHttpError) {
        setError(err.message);
      } else {
        setError('Errore nella creazione ristorante');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const generateSlug = () => {
    const slug = form.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    setForm({ ...form, slug });
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <a
            href="/admin/restaurants"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              display: 'inline-block',
            }}
          >
            ← Torna ai ristoranti
          </a>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>
            Nuovo Ristorante
          </h1>
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        {error && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginBottom: '1.5rem',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '2rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Nome Ristorante *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Slug */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Slug (URL) *
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="es: pizzeria-da-mario"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={generateSlug}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Auto
                </button>
              </div>
              <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                Verrà usato nell'URL: /restaurants/slug
              </small>
            </div>

            {/* Address */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Indirizzo
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Via Roma 123, Roma"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Phone */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Telefono
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+39 06 12345678"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Coordinates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  Latitudine
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="41.9028"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  Longitudine
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="12.4964"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Active */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                style={{ width: '1.25rem', height: '1.25rem' }}
              />
              <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                Ristorante attivo
              </label>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <button
                type="button"
                onClick={() => router.push('/admin/restaurants')}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? 'Creazione...' : 'Crea Ristorante'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminNewRestaurantPage() {
  return (
    <AdminGuard>
      <NewRestaurantPage />
    </AdminGuard>
  );
}
