'use client';

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { BarChart3, Shield, Users, FileCheck, Zap, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/ui/logo";

export default function Home() {
    const router = useRouter();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-[#fafafa] overflow-hidden text-slate-900 font-sans">
            {/* Top Navigation */}
            <header className="container mx-auto px-6 py-6 flex items-center justify-between">
                <Logo />

                {!user && (
                    <Button
                        variant="outline"
                        onClick={() => router.push("/auth")}
                        className="rounded-full px-6 transition-all duration-300 border-slate-200 hover:border-slate-300 font-medium bg-white text-slate-700"
                    >
                        Login
                    </Button>
                )}
            </header>

            {/* Hero Section */}
            <div className="relative pt-20 pb-24 flex flex-col items-center justify-center text-center px-4">
                {/* Background Glow - strictly using ProofPoint primary color */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-[100%] blur-[80px] -z-10" />

                <h1 className="text-6xl md:text-[80px] font-black tracking-tight leading-[1.05] mb-6 max-w-4xl text-slate-900">
                    No Evidence,<br />
                    <span className="text-primary">No Score.</span>
                </h1>

                <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl font-normal leading-relaxed">
                    ProofPoint revolutionizes employee appraisals with a data-driven approach.
                    Every rating requires documentation. Every score is justified.
                </p>

                <Button
                    size="lg"
                    onClick={() => router.push(user ? "/dashboard" : "/auth")}
                    className="rounded-full text-lg px-8 py-7 bg-primary hover:bg-primary/90 text-white font-semibold transition-transform duration-300 hover:scale-105 shadow-lg shadow-primary/25"
                >
                    {user ? "Open Dashboard" : "Start Appraising Now"}
                </Button>
            </div>

            {/* Features Grid */}
            <div className="container mx-auto px-6 py-16">
                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {/* Feature 1 */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
                        <div className="mb-6 w-full h-32 rounded-2xl bg-[#fff0f5] flex items-center justify-center">
                            <BarChart3 className="w-12 h-12 text-pink-500" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Real-Time Scoring</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Watch weighted scores calculate instantly as you rate. Section weights and letter grades update live.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
                        <div className="mb-6 w-full h-32 rounded-2xl bg-[#fff7ed] flex items-center justify-center">
                            <Shield className="w-12 h-12 text-orange-400" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Evidence-Based</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Smart input validation ensures every non-standard rating has documented proof. No shortcuts.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
                        <div className="mb-6 w-full h-32 rounded-2xl bg-[#ecfdf5] flex items-center justify-center">
                            <Users className="w-12 h-12 text-emerald-500" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Role-Based Flow</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Staff self-assess, managers review side-by-side, directors approve. Clear accountability chain.
                        </p>
                    </div>

                    {/* Feature 4 */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
                        <div className="mb-6 w-full h-32 rounded-2xl bg-[#f0f9ff] flex items-center justify-center">
                            <FileCheck className="w-12 h-12 text-blue-400" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">100% Coverage</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Ensure complete evidence coverage across all appraisal sections before formal submission.
                        </p>
                    </div>

                    {/* Feature 5 */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
                        <div className="mb-6 w-full h-32 rounded-2xl bg-[#faf5ff] flex items-center justify-center">
                            <Zap className="w-12 h-12 text-purple-400" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Fast Workflow</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Streamlined interfaces reduce the time required to complete rigorous performance reviews.
                        </p>
                    </div>

                    {/* Feature 6 */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
                        <div className="mb-6 w-full h-32 rounded-2xl bg-[#eff6ff] flex items-center justify-center">
                            <Lock className="w-12 h-12 text-indigo-400" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Enterprise Security</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Role-based access controls ensure sensitive appraisal data is only visible to authorized personnel.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="py-12 mt-4 text-center text-sm text-slate-500 font-medium">
                © 2026 MAD Labs by Millennia World School
            </footer>
        </div>
    );
}
