"use client";

import { createContext, useContext, ReactNode } from "react";
import {
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from "next-auth/react";

type AppRole = "admin" | "staff" | "manager" | "director";

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
  const loading = status === "loading";

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
    await nextAuthSignOut({ redirect: false });
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const value: AuthContextType = {
    user,
    session: session ? { user: user! } : null,
    profile,
    roles,
    loading,
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
