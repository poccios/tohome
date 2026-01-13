'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, type MeResponse } from '@/lib/api';
import { HttpError } from '@/lib/http';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Auth Guard Component
 * Protects pages by checking if user is authenticated
 * Redirects to /login if not authenticated
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<MeResponse['user'] | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await getMe();
        setUser(response.user);
        setIsAuthenticated(true);
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          // Not authenticated, redirect to login
          router.push('/login');
        } else {
          // Other error, log and show as not authenticated
          console.error('Auth check failed:', error);
          setIsAuthenticated(false);
        }
      }
    }

    checkAuth();
  }, [router]);

  // Loading state
  if (isAuthenticated === null) {
    return <>{fallback || <LoadingSpinner />}</>;
  }

  // Not authenticated (error case, should redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated, render children
  return <>{children}</>;
}

/**
 * Simple loading spinner
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Hook to get current user
 * Must be used within AuthGuard or after authentication check
 */
export function useUser() {
  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await getMe();
        setUser(response.user);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch user'));
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return { user, loading, error };
}
