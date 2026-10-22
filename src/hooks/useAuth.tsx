"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import {
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from "next-auth/react";

import { keepFresh } from "mws-central-auth/client";

type AppRole =
  | "admin"
  | "staff"
  | "manager"
  | "supervisor"
  | "director";

type AuthMode = "hub" | "nextauth";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  department_id: string | null;
}

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  session: { user: User } | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  authMode: AuthMode | null;
  authModeError: string | null;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isDirector: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authModeError, setAuthModeError] = useState<string | null>(null);
  const [hubRefreshUrl, setHubRefreshUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/mode", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Authentication mode lookup failed (HTTP ${response.status})`);
        const result = (await response.json()) as { mode?: AuthMode; refreshUrl?: string };
        if (result.mode !== "hub" && result.mode !== "nextauth") {
          throw new Error("Authentication mode response is invalid");
        }
        if (result.mode === "hub" && !result.refreshUrl) {
          throw new Error("Hub refresh URL is not configured");
        }
        if (!cancelled) {
          setAuthMode(result.mode);
          setHubRefreshUrl(result.refreshUrl ?? null);
          setAuthModeError(null);
        }
      })
      .catch((error) => {
        console.error("Unable to load authentication mode:", error);
        if (!cancelled) {
          setAuthModeError(error instanceof Error ? error.message : "Authentication mode is unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authMode !== "hub" || !session || !hubRefreshUrl) return;
    return keepFresh({
      refreshUrl: hubRefreshUrl,
      onEnded: () => window.location.assign("/auth/logout"),
    });
  }, [authMode, session, hubRefreshUrl]);

  const loading = status === "loading" || (authMode === null && authModeError === null);

  // Extract user data from NextAuth session
  const user: User | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? "",
      }
    : null;

  // Extract profile from session
  const profile: Profile | null = session?.user
    ? {
        id: session.user.id,
        user_id: session.user.id,
        email: session.user.email ?? "",
        full_name: session.user.name ?? null,
        department_id:
          (session.user as { departmentId?: string | null }).departmentId ??
          null,
      }
    : null;

  // Extract roles from session
  const roles: AppRole[] = session?.user
    ? (((session.user as { roles?: string[] }).roles ?? []) as AppRole[])
    : [];

  const signUp = async (email: string, password: string, fullName: string) => {
    if (authMode === "hub") {
      return { error: new Error("Account creation is managed by the MWS Hub") };
    }
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: new Error(data.error || "Failed to sign up") };
      }

      // Auto sign in after successful signup
      const signInResult = await nextAuthSignIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        return { error: new Error(signInResult.error) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (authMode === "hub") {
      window.location.assign("/auth/hub");
      return { error: null };
    }
    try {
      const result = await nextAuthSignIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("SignIn Result:", result); // Debugging

      if (result?.error) {
        // Convert Auth.js error codes to user-friendly messages
        let errorMessage = result.error;
        if (result.error === "CredentialsSignin") {
          errorMessage =
            "Invalid email or password. Please check your credentials and try again.";
        }
        return { error: new Error(errorMessage) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    if (authMode === "hub") {
      window.location.assign("/auth/hub");
      return { error: null };
    }
    try {
      const result = await nextAuthSignIn("google", {
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.error) {
        return { error: new Error(result.error) };
      }

      if (result?.url) {
        window.location.href = result.url;
        return { error: null };
      }

      return { error: new Error("Unable to start Google sign-in") };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    if (authMode === "hub") {
      window.location.assign("/auth/logout");
      return;
    }
    await nextAuthSignOut({ redirect: false });
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const value: AuthContextType = {
    user,
    session: session ? { user: user! } : null,
    profile,
    roles,
    loading,
    authMode,
    authModeError,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    hasRole,
    isAdmin: hasRole("admin"),
    isManager: hasRole("manager"),
    isDirector: hasRole("director"),
    isStaff: hasRole("staff"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
