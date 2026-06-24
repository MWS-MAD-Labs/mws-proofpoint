"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface NotificationLog {
  id: string;
  type: string;
  status: string;
  created_at: string;
  staff_name?: string;
  period?: string;
  error?: string;
}

interface NotificationStats {
  type: string;
  status: string;
  count: number;
}

export function NotificationDashboard() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [notifRes, statsRes] = await Promise.all([
        fetch(
          `/api/admin/notifications${filter !== "all" ? `?status=${filter}` : ""}`,
        ),
        fetch("/api/admin/notifications/stats"),
      ]);

      const notifData = await notifRes.json();
      const statsData = await statsRes.json();

      setNotifications(notifData.data || []);
      setStats(statsData.data || []);
    } catch (error) {
      console.error("Failed to fetch notification data:", error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const sentCount = stats
    .filter((s) => s.status === "sent")
    .reduce((sum, s) => sum + s.count, 0);
  const failedCount = stats
    .filter((s) => s.status === "failed")
    .reduce((sum, s) => sum + s.count, 0);
  const pendingCount = stats
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{sentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {pendingCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sentCount + failedCount + pendingCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notification Logs</CardTitle>
              <CardDescription>View all sent notifications</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "sent" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("sent")}
            >
              Sent
            </Button>
            <Button
              variant={filter === "failed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("failed")}
            >
              Failed
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Pending
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications found
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(notif.status)}
                    <div>
                      <div className="font-medium">
                        {notif.type.replace(/_/g, " ")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {notif.staff_name} • {notif.period}
                      </div>
                      {notif.error && (
                        <div className="text-sm text-red-600">
                          {notif.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        notif.status === "sent"
                          ? "default"
                          : notif.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className={
                        notif.status === "sent"
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : notif.status === "failed"
                            ? "bg-red-100 text-red-800 hover:bg-red-200"
                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                      }
                    >
                      {notif.status}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {new Date(notif.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
