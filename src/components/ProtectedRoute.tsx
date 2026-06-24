'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

type AppRole = 'admin' | 'staff' | 'manager' | 'director';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: AppRole[];
}

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/auth');
      } else if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
        if (!hasRequiredRole) {
          router.replace('/dashboard');
        }
      }
    }
  }, [user, roles, loading, requiredRoles, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
  }

  return <>{children}</>;
}
