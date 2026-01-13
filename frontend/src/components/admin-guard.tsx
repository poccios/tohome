/**
 * Admin Guard Component
 * Redirects to /admin/login if admin key is not present
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminKey } from '@/hooks/useAdminKey';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { adminKey, isLoaded } = useAdminKey();

  useEffect(() => {
    // Wait for admin key to be loaded from sessionStorage
    if (!isLoaded) return;

    // If no admin key and not already on login page, redirect to login
    if (!adminKey && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [adminKey, isLoaded, pathname, router]);

  // Show loading while checking admin key
  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <p style={{ color: '#666' }}>Caricamento...</p>
      </div>
    );
  }

  // If no admin key, show nothing (will redirect)
  if (!adminKey && pathname !== '/admin/login') {
    return null;
  }

  // Admin key is present, render children
  return <>{children}</>;
}
