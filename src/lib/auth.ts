// src/lib/auth.ts

// ✅ FIX: hanya satu import dari "next-auth" — tidak ada duplikat
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Type augmentation (Next Auth v5 style) ───────────────────────────────────

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    roles: string[];
    departmentId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      roles: string[];
      departmentId?: string | null;
    };
  }
}

// ─── Auth Config ───────────────────────────────────────────────────────────────

export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email:    z.string().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials);

        if (!parsed.success) {
          console.log("[auth] Invalid credentials format");
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where:   { email },
          include: {
            roles:   true,
            profile: true,
          },
        });

        if (!user) {
          console.log(`[auth] User not found: ${email}`);
          return null;
        }

        if (!user.passwordHash) {
          console.log(`[auth] No password hash: ${email}`);
          return null;
        }

        if (
          user.passwordHash === "temporary_hash_change_me" ||
          user.passwordHash === "hashedpassword"
        ) {
          console.log(`[auth] Temporary password rejected: ${email}`);
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          console.log(`[auth] Wrong password: ${email}`);
          return null;
        }

        if (user.status !== "active") {
          console.log(`[auth] Account not active (${user.status}): ${email}`);
          return null;
        }

        const roleNames = user.roles.map((r) => r.role as string);
        console.log(`[auth] ✅ Login: ${email} | roles: ${roleNames.join(", ")}`);

        return {
          id:           user.id,
          email:        user.email,
          name:         user.profile?.fullName    ?? null,
          roles:        roleNames,
          departmentId: user.profile?.departmentId ?? null,
        };
      },
    }),
  ],

  callbacks: {
    // ✅ token & user bertipe any di NextAuth v5 — ini intentional untuk custom fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id           = user.id;
        token.roles        = user.roles        ?? [];
        token.departmentId = user.departmentId ?? null;
      }
      return token;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id           = token.id;
        session.user.roles        = token.roles        ?? [];
        session.user.departmentId = token.departmentId ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth",
    error:  "/auth",
  },

  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const authOptions = authConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);