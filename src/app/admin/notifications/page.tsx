'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { NotificationDashboard } from '@/components/admin/NotificationDashboard';

export default function AdminNotificationsPage() {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/20">
        <Header />
        <main className="container mx-auto py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notification Dashboard</h1>
            <p className="text-muted-foreground">
              Delivery status and failure monitoring for assessment emails.
            </p>
          </div>

          <NotificationDashboard />
        </main>
      </div>
    </ProtectedRoute>
  );
}
