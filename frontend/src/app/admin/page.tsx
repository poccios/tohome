/**
 * Admin Dashboard Page
 * Shows navigation links to admin sections
 */

'use client';

import { useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/admin-guard';
import { useAdminKey } from '@/hooks/useAdminKey';

function AdminDashboard() {
  const router = useRouter();
  const { clearAdminKey } = useAdminKey();

  const handleLogout = () => {
    if (confirm('Vuoi disconnetterti dall\'area admin?')) {
      clearAdminKey();
      router.push('/admin/login');
    }
  };

  const navItems = [
    {
      title: 'Ristoranti',
      description: 'Gestisci ristoranti, orari e regole di consegna',
      href: '/admin/restaurants',
      icon: '🍽️',
    },
    {
      title: 'Menu',
      description: 'Gestisci categorie, prodotti e opzioni',
      href: '/admin/menu',
      icon: '📋',
    },
  ];

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
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
              ToHome Admin
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              Pannello di amministrazione
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a
              href="/"
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              Vai al sito
            </a>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                color: '#dc2626',
                backgroundColor: '#fff',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Dashboard
          </h2>
          <p style={{ color: '#6b7280' }}>
            Seleziona una sezione per iniziare
          </p>
        </div>

        {/* Navigation Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '2rem',
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.2s',
                cursor: 'pointer',
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
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {item.icon}
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {item.title}
              </h3>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                {item.description}
              </p>
            </a>
          ))}
        </div>

        {/* Info Box */}
        <div
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
          }}
        >
          <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e40af' }}>
            ℹ️ Informazioni
          </h4>
          <p style={{ color: '#1e40af', fontSize: '0.875rem', margin: 0 }}>
            L'admin key è salvata solo in questa sessione del browser. Ricordati di fare logout quando hai finito.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}
