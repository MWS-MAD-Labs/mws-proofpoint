'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { BarChart3, Shield, Users, FileCheck, Zap, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/ui/logo";

const features = [
    {
        title: "Real-Time Scoring",
        description: "Watch weighted scores calculate instantly as section weights and performance levels update live.",
        icon: BarChart3,
        tone: "bg-secondary-soft text-secondary-foreground",
    },
    {
        title: "Evidence-Based",
        description: "Smart validation ensures every non-standard rating has documented proof. No shortcuts.",
        icon: Shield,
        tone: "bg-warning-soft text-warning-foreground",
    },
    {
        title: "Role-Based Flow",
        description: "Staff self-assess, managers review, and directors approve through a clear accountability chain.",
        icon: Users,
        tone: "bg-success-soft text-success",
    },
    {
        title: "Complete Coverage",
        description: "Confirm evidence coverage across every appraisal section before formal submission.",
        icon: FileCheck,
        tone: "bg-info-soft text-info-foreground",
    },
    {
        title: "Focused Workflow",
        description: "Purposeful interfaces reduce the time required to complete rigorous performance reviews.",
        icon: Zap,
        tone: "bg-secondary-soft text-secondary-foreground",
    },
    {
        title: "Protected by Role",
        description: "Access controls keep sensitive appraisal data visible only to authorized people.",
        icon: Lock,
        tone: "bg-destructive-soft text-destructive",
    },
];

export default function Home() {
    const router = useRouter();
    const { user } = useAuth();

    return (
        <div className="min-h-screen overflow-hidden bg-background text-foreground">
            <header className="container flex items-center justify-between px-6 py-6">
                <Logo />
                {!user && (
                    <Button variant="outline" onClick={() => router.push("/auth")}>
                        Log in
                    </Button>
                )}
            </header>

            <main>
                <section className="relative px-5 pb-24 pt-16 text-center sm:pt-24">
                    <div className="absolute left-1/2 top-0 -z-10 h-72 w-[min(92vw,720px)] -translate-x-1/2 rounded-full bg-secondary/35 blur-3xl" />
                    <div className="mx-auto max-w-4xl">
                        <div className="mx-auto mb-6 w-fit rounded-full border border-secondary bg-secondary-soft px-4 py-2 font-heading text-xs font-extrabold uppercase tracking-[0.18em] text-secondary-foreground">
                            Evidence over assumption
                        </div>
                        <h1 className="mb-6 font-heading text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                            No Evidence,
                            <br />
                            <span className="text-primary">No Score.</span>
                        </h1>
                        <p className="mx-auto mb-10 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                            ProofPoint makes employee appraisals transparent and accountable. Every rating requires documentation, and every score can be justified.
                        </p>
                        <Button size="lg" onClick={() => router.push(user ? "/dashboard" : "/auth")}>
                            {user ? "Open dashboard" : "Start appraising"}
                        </Button>
                    </div>
                </section>

                <section className="container px-6 pb-20" aria-labelledby="capabilities-heading">
                    <div className="mx-auto mb-10 max-w-2xl text-center">
                        <h2 id="capabilities-heading" className="text-3xl sm:text-4xl">Clear evidence. Trusted decisions.</h2>
                        <p className="mt-3 text-muted-foreground">A consistent performance workspace built around truth, reflection, and responsible action.</p>
                    </div>
                    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => (
                            <Card key={feature.title} className="hover-lift">
                                <CardContent className="p-6">
                                    <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-lg ${feature.tone}`}>
                                        <feature.icon className="h-7 w-7" aria-hidden="true" />
                                    </div>
                                    <h3 className="mb-2 text-xl">{feature.title}</h3>
                                    <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            </main>

            <footer className="border-t border-border bg-card py-8 text-center text-sm text-muted-foreground">
                © 2026 MAD Labs by Millennia World School
            </footer>
        </div>
    );
}
