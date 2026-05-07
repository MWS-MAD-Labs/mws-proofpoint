"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  Activity,
  Loader2,
  Mail,
  Lock,
  User,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
});

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3.1.8 3.8 1.4l2.6-2.5C16.7 3.2 14.6 2.4 12 2.4 6.8 2.4 2.6 6.7 2.6 12s4.2 9.6 9.4 9.6c5.4 0 9-3.8 9-9.1 0-.6-.1-1-.1-1.3z"
      />
      <path
        fill="#34A853"
        d="M3.7 7.5l3.2 2.4c.9-2.1 2.8-3.5 5.1-3.5 1.8 0 3.1.8 3.8 1.4l2.6-2.5C16.7 3.2 14.6 2.4 12 2.4c-3.6 0-6.8 2-8.3 5.1z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.6c2.5 0 4.6-.8 6.1-2.2l-2.8-2.2c-.7.5-1.7.9-3.3.9-2.3 0-4.2-1.5-5-3.6l-3.2 2.5c1.5 3.1 4.7 5.2 8.2 5.2z"
      />
      <path
        fill="#4285F4"
        d="M21 12.5c0-.7-.1-1.1-.2-1.6H12v3.2h5c-.1 1-.8 2.3-1.7 3.1l2.8 2.2c1.7-1.6 2.9-3.9 2.9-6.9z"
      />
    </svg>
  );
}

export default function Auth() {
  const router = useRouter();
  const { user, signIn, signInWithGoogle, signUp, loading } = useAuth();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      loginSchema.parse(loginData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) newErrors[e.path[0] as string] = e.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Login failed",
        description:
          error.message === "Invalid login credentials"
            ? "Invalid email or password. Please try again."
            : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      router.push("/dashboard");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse(signupData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) newErrors[e.path[0] as string] = e.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(
      signupData.email,
      signupData.password,
      signupData.fullName,
    );
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast({
          title: "Account exists",
          description:
            "An account with this email already exists. Please login instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Account created!",
        description:
          "Welcome to ProofPoint. You can now access your dashboard.",
      });
      router.push("/dashboard");
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-30 animate-pulse" />
          <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 grid-pattern" />
      <div className="absolute inset-0 mesh-gradient" />

      {/* Floating Orbs */}
      <div className="absolute top-[10%] left-[15%] w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-[10%] right-[10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "-3s" }}
      />
      <div
        className="absolute top-[50%] right-[30%] w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "-1.5s" }}
      />

      {/* Content */}
      <div className="relative w-full max-w-md px-4">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to home</span>
        </Link>

        {/* Glass Card */}
        <Card className="glass-panel-strong border-border/30 shadow-2xl overflow-hidden">
          {/* Gradient Top Border */}
          <div className="h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

          <CardHeader className="text-center space-y-4 pt-8 pb-2">
            {/* Logo */}
            <div className="mx-auto relative">
              <div className="absolute inset-0 bg-primary rounded-2xl blur-xl opacity-40 animate-pulse-glow" />
              <div className="relative w-16 h-16 rounded-2xl bg-primary glow-primary flex items-center justify-center">
                <Activity className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>

            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold tracking-tight">
                ProofPoint
              </CardTitle>
              <CardDescription className="text-muted-foreground flex items-center justify-center gap-2">
                <Sparkles className="h-3 w-3" />
                <span>Performance Command Center</span>
                <Sparkles className="h-3 w-3" />
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-4 pb-8 px-8">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger
                  value="login"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-300"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-300"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 text-base font-medium border-border/60 bg-background/70 hover:bg-background"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <GoogleIcon />
                    )}
                    Continue with Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/40" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wider">
                      <span className="bg-background px-2 text-muted-foreground">
                        or use email
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="login-email"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@company.com"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      className={`h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ${errors.email ? "border-destructive" : ""}`}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="login-password"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Password
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      className={`h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ${errors.password ? "border-destructive" : ""}`}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium glow-primary hover:scale-[1.02] transition-all duration-300"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : null}
                    Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-name"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      Full Name
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupData.fullName}
                      onChange={(e) =>
                        setSignupData({
                          ...signupData,
                          fullName: e.target.value,
                        })
                      }
                      className={`h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ${errors.fullName ? "border-destructive" : ""}`}
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-email"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      value={signupData.email}
                      onChange={(e) =>
                        setSignupData({ ...signupData, email: e.target.value })
                      }
                      className={`h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ${errors.email ? "border-destructive" : ""}`}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-password"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Password
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) =>
                        setSignupData({
                          ...signupData,
                          password: e.target.value,
                        })
                      }
                      className={`h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20 transition-all ${errors.password ? "border-destructive" : ""}`}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium glow-primary hover:scale-[1.02] transition-all duration-300"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : null}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Footer Text */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              By continuing, you agree to our Terms of Service
            </p>
          </CardContent>
        </Card>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>Secured with enterprise-grade encryption</span>
        </div>
      </div>
    </div>
  );
}
