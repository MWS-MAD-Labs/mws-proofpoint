'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import {
    ClipboardList,
    Users,
    Building2,
    FileText,
    Settings,
    ChevronRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowRight,
    Zap,
    Loader2,
    TrendingUp
} from 'lucide-react';

interface Assessment {
    id: string;
    period: string;
    status: string;
    created_at: string;
    staff_id: string;
    staff_name: string;
}

function DashboardContent() {
    const { profile, roles, isAdmin, isManager, isDirector, signOut } = useAuth();
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAssessments = async () => {
            const { data, error } = await api.getAssessments({ limit: 5 });

            if (error) {
                console.error('Error fetching assessments:', error);
            } else if (data) {
                setAssessments(data as Assessment[]);
            }
            setLoading(false);
        };

        fetchAssessments();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return (
                    <Badge variant="outline" className="bg-muted/50 border-border text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" /> Draft
                    </Badge>
                );
            case 'self_submitted':
                return (
                    <Badge className="bg-primary/10 text-primary border border-primary/20">
                        <ChevronRight className="h-3 w-3 mr-1" /> Submitted
                    </Badge>
                );
            case 'manager_reviewed':
                return (
                    <Badge className="bg-score-3/10 text-score-3 border border-score-3/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Reviewed
                    </Badge>
                );
            case 'director_approved':
            case 'approved':
            case 'acknowledged':
                return (
                    <Badge className="bg-score-4/10 text-score-4 border border-score-4/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                    </Badge>
                );
            case 'rejected':
                return (
                    <Badge className="bg-destructive/10 text-destructive border border-destructive/20">
                        <AlertCircle className="h-3 w-3 mr-1" /> Rejected
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const roleLabels = roles.map(role => {
        switch (role) {
            case 'admin': return 'Administrator';
            case 'manager': return 'Manager';
            case 'director': return 'Director';
            case 'staff': return 'Staff';
            default: return role;
        }
    });

    const getAssessmentUrl = (assessment: Assessment) => {
        const isTeamAssessment = assessment.staff_id !== profile?.user_id;

        if (isDirector && isTeamAssessment) {
            return `/director?id=${assessment.id}`;
        }

        if ((isManager || isAdmin) && isTeamAssessment) {
            return `/manager?id=${assessment.id}`;
        }

        return `/assessment?id=${assessment.id}`;
    };


    const actionCards = [
        {
            title: 'Self Assessment',
            description: 'Complete your performance evaluation',
            icon: ClipboardList,
            link: '/assessment',
            buttonText: 'Start Assessment',
            buttonVariant: 'default' as const,
            show: true,
            gradient: 'from-blue-500/10 to-cyan-500/10',
            iconColor: 'text-blue-500'
        },
        {
            title: 'Team Dashboard',
            description: 'Review your team\'s assessments',
            icon: Users,
            link: '/manager',
            buttonText: 'View Team',
            buttonVariant: 'outline' as const,
            show: isManager || isAdmin,
            gradient: 'from-violet-500/10 to-purple-500/10',
            iconColor: 'text-violet-500'
        },
        {
            title: 'Director Overview',
            description: 'Approve and oversee all departments',
            icon: Building2,
            link: '/director',
            buttonText: 'View Organization',
            buttonVariant: 'outline' as const,
            show: isDirector || isAdmin,
            gradient: 'from-emerald-500/10 to-teal-500/10',
            iconColor: 'text-emerald-500'
        },
        {
            title: 'Rubric Templates',
            description: 'Create and manage evaluation criteria',
            icon: FileText,
            link: '/rubrics',
            buttonText: 'Manage Rubrics',
            buttonVariant: 'outline' as const,
            show: isManager || isDirector || isAdmin,
            gradient: 'from-amber-500/10 to-orange-500/10',
            iconColor: 'text-amber-500'
        },
        {
            title: 'Admin Panel',
            description: 'Manage users, roles, and departments',
            icon: Settings,
            link: '/admin',
            buttonText: 'Open Admin',
            buttonVariant: 'outline' as const,
            show: isAdmin,
            gradient: 'from-rose-500/10 to-pink-500/10',
            iconColor: 'text-rose-500'
        }
    ];

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />
            <div className="fixed inset-0 mesh-gradient opacity-30 pointer-events-none" />

            {/* Floating Orbs */}
            <div className="fixed top-[20%] right-[10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-float" />
            <div className="fixed bottom-[20%] left-[5%] w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-float" style={{ animationDelay: '-3s' }} />

            <Header />

            <main className="container relative mx-auto px-4 py-8">
                {/* Welcome Section */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            <Zap className="h-3.5 w-3.5" />
                            <span>Dashboard</span>
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                        Welcome back, <span className="text-gradient-hero">{profile?.full_name || 'User'}</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-3">
                        {roleLabels.map(role => (
                            <Badge
                                key={role}
                                variant="secondary"
                                className="bg-secondary/50 border border-border/50 backdrop-blur-sm"
                            >
                                {role}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Action Cards Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
                    {actionCards.filter(card => card.show).map((card) => (
                        <Card
                            key={card.title}
                            className="group relative glass-panel border-border/30 hover-lift hover-glow overflow-hidden"
                        >
                            {/* Gradient Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                            <CardHeader className="relative">
                                <div className="flex items-center justify-between">
                                    <div className={`w-12 h-12 rounded-xl bg-background/80 border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                        <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                                </div>
                                <CardTitle className="mt-4 text-xl">{card.title}</CardTitle>
                                <CardDescription className="text-muted-foreground">{card.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="relative">
                                <Link href={card.link}>
                                    <Button
                                        variant={card.buttonVariant}
                                        className={`w-full ${card.buttonVariant === 'default' ? 'glow-primary' : 'glass-panel hover:border-primary/50'} transition-all duration-300`}
                                    >
                                        {card.buttonText}
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Recent Assessments */}
                <Card className="glass-panel border-border/30 overflow-hidden">
                    {/* Gradient Top Border */}
                    <div className="h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />

                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    Recent Assessments
                                </CardTitle>
                                <CardDescription>
                                    {isManager || isAdmin || isDirector ? 'Latest evaluations across your organization' : 'Your latest performance evaluations'}
                                </CardDescription>
                            </div>
                            <Link href="/assessment">
                                <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary rounded-full blur-lg opacity-30 animate-pulse" />
                                    <Loader2 className="relative h-8 w-8 animate-spin text-primary" />
                                </div>
                            </div>
                        ) : assessments.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                    <ClipboardList className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <p className="text-muted-foreground mb-4">No assessments yet. Start your first one!</p>
                                <Link href="/assessment">
                                    <Button className="glow-primary">
                                        <Zap className="h-4 w-4 mr-2" />
                                        Start Assessment
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {assessments.map((assessment) => (
                                    <Link
                                        key={assessment.id}
                                        href={getAssessmentUrl(assessment)}
                                        className="block group"
                                        aria-label={`Open assessment for ${assessment.staff_name || assessment.period}`}
                                    >
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 hover:bg-background/80 transition-all duration-300 group-hover:shadow-lg">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                    <FileText className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                                        {(isManager || isAdmin || isDirector) && assessment.staff_name ? (
                                                            <>
                                                                <span className="font-bold">{assessment.staff_name}</span>
                                                                <span className="text-muted-foreground mx-2">•</span>
                                                                <span className="text-sm">{assessment.period}</span>
                                                            </>
                                                        ) : (
                                                            assessment.period
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {new Date(assessment.created_at).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {getStatusBadge(assessment.status)}
                                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sign Out */}
                <div className="mt-8 flex justify-end">
                    <Button
                        variant="ghost"
                        onClick={signOut}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    >
                        Sign Out
                    </Button>
                </div>
            </main>
        </div>
    );
}

export default function Dashboard() {
    return (
        <ProtectedRoute>
            <DashboardContent />
        </ProtectedRoute>
    );
}
