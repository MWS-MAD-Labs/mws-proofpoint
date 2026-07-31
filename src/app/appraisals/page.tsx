"use client";

import Link from "next/link";
import { ClipboardList, UserRoundCheck, Users } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function PerformanceAppraisalsContent() {
  const { isManager, isAdmin } = useAuth();
  const canAppraiseStaff = isManager || isAdmin;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-black tracking-tight">Performance Appraisals</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {canAppraiseStaff
                ? "Manage your own appraisal cycle and performance appraisals for your staff."
                : "Review appraisals that have completed director review and acknowledge the final result."}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {canAppraiseStaff ? (
              <>
                <Card className="glass-panel border-border/30">
                  <CardHeader>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <UserRoundCheck className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Self-Assessment</CardTitle>
                    <CardDescription>
                      Start or continue your own manager performance appraisal cycle before director review.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      <Link href="/assessment">Open Self-Assessment</Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass-panel border-border/30">
                  <CardHeader>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Staff Appraisal</CardTitle>
                    <CardDescription>
                      Start a staff appraisal or open the staff appraisal workspace to follow active cycles.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <Button asChild>
                      <Link href="/manager/new">Start Appraisal</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/manager">View Staff Appraisals</Link>
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="glass-panel border-border/30 md:col-span-2">
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <ClipboardList className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>My Appraisals</CardTitle>
                  <CardDescription>
                    Review director-reviewed appraisals, provide acknowledgement, and view completed cycles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full sm:w-auto">
                    <Link href="/assessment">View My Appraisals</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PerformanceAppraisalsPage() {
  return (
    <ProtectedRoute>
      <PerformanceAppraisalsContent />
    </ProtectedRoute>
  );
}
