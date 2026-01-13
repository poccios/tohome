'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyLoginLink } from '@/lib/api';
import { getDeviceId } from '@/lib/device';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError('No token provided');
      return;
    }

    const verify = async () => {
      try {
        const deviceId = getDeviceId();
        await verifyLoginLink(token, deviceId);

        setStatus('success');

        // Redirect to home after a brief delay
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verify();
  }, [searchParams, router]);

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
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          borderRadius: '8px',
          border: '1px solid #ddd',
          backgroundColor: '#fff',
          textAlign: 'center',
        }}
      >
        {status === 'verifying' && (
          <>
            <div
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 1rem',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #0070f3',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
              Verifying...
            </h1>
            <p style={{ color: '#666' }}>Please wait while we log you in</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 1rem',
                backgroundColor: '#d4edda',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}
            >
              ✓
            </div>
            <h1
              style={{
                fontSize: '1.5rem',
                marginBottom: '0.5rem',
                color: '#155724',
              }}
            >
              Success!
            </h1>
            <p style={{ color: '#666' }}>Redirecting to home...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 1rem',
                backgroundColor: '#f8d7da',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}
            >
              ✗
            </div>
            <h1
              style={{
                fontSize: '1.5rem',
                marginBottom: '0.5rem',
                color: '#721c24',
              }}
            >
              Verification Failed
            </h1>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>{error}</p>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                color: '#fff',
                backgroundColor: '#0070f3',
                textDecoration: 'none',
                borderRadius: '4px',
              }}
            >
              Try Again
            </a>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
