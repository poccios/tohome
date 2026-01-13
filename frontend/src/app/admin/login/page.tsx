/**
 * Admin Login Page
 * Input for admin key -> save to sessionStorage -> redirect to /admin
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminKey } from '@/hooks/useAdminKey';

export default function AdminLoginPage() {
  const router = useRouter();
  const { adminKey, setAdminKey } = useAdminKey();
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  // If already has admin key, redirect to admin dashboard
  useEffect(() => {
    if (adminKey) {
      router.push('/admin');
    }
  }, [adminKey, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inputKey.trim()) {
      setError('Admin key is required');
      return;
    }

    if (inputKey.length < 32) {
      setError('Admin key must be at least 32 characters');
      return;
    }

    // Save admin key to sessionStorage
    setAdminKey(inputKey.trim());

    // Redirect to admin dashboard
    router.push('/admin');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#f9fafb',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Admin Panel
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Enter your admin key to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="adminKey"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#374151',
              }}
            >
              Admin Key
            </label>
            <input
              type="password"
              id="adminKey"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Enter admin key (min 32 chars)"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            />
            <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
              This key is stored only in your browser session
            </small>
          </div>

          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: 500,
              color: '#fff',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            Login
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <a
            href="/"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            ← Back to home
          </a>
        </div>
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          maxWidth: '400px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#92400e',
        }}
      >
        <strong>For development:</strong>
        <br />
        Default key: <code style={{ backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
          change-me-long-random-admin-key-min-32-chars
        </code>
      </div>
    </div>
  );
}
