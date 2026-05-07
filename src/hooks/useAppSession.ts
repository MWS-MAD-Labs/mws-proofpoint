'use client';
 
import { useSession } from 'next-auth/react';
 
export interface AppUser {
  id: string;
  email: string;
  name?: string | null;
  roles: string[];
  departmentId?: string | null;
}
 
export function useAppSession() {
  const { data: session, status } = useSession();
 
  const user = session?.user
    ? {
        id: (session.user as any).id as string,
        email: session.user.email ?? '',
        name: session.user.name ?? null,
        roles: ((session.user as any).roles as string[]) ?? [],
        departmentId: ((session.user as any).departmentId as string | null) ?? null,
      }
    : null;
 
  return {
    user,
    status,
    isLoading: status === 'loading',
    isManager: user?.roles.includes('manager') ?? false,
    isStaff: user?.roles.includes('staff') ?? false,
    isAdmin: user?.roles.includes('admin') ?? false,
    isDirector: user?.roles.includes('director') ?? false,
  };
}