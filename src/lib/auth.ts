import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { pool, queryOne } from "@/lib/db";

interface DbCredentialUser {
  id: string;
  email: string;
  password_hash: string;
}

interface DbAuthUser {
  id: string;
  email: string;
  full_name: string | null;
  department_id: string | null;
  roles: string[] | null;
}

interface AppAuthUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  departmentId: string | null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapDbUserToAuthUser(user: DbAuthUser): AppAuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.full_name ?? null,
    roles: user.roles ?? [],
    departmentId: user.department_id ?? null,
  };
}

async function getAuthUserById(userId: string) {
  return queryOne<DbAuthUser>(
    `SELECT
            u.id,
            u.email,
            p.full_name,
            p.department_id,
            COALESCE(
                ARRAY_AGG(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
                ARRAY[]::text[]
            ) AS roles
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         WHERE u.id = $1
         GROUP BY u.id, p.full_name, p.department_id`,
    [userId],
  );
}

async function getAuthUserByEmail(email: string) {
  return queryOne<DbAuthUser>(
    `SELECT
            u.id,
            u.email,
            p.full_name,
            p.department_id,
            COALESCE(
                ARRAY_AGG(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
                ARRAY[]::text[]
            ) AS roles
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         WHERE LOWER(u.email) = LOWER($1)
         GROUP BY u.id, p.full_name, p.department_id`,
    [email],
  );
}

async function upsertGoogleUserByEmail(email: string, fullName: string | null) {
  const normalizedEmail = normalizeEmail(email);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [normalizedEmail],
    );

    let userId = existingUser.rows[0]?.id;

    if (!userId) {
      const newUserId = randomUUID();
      const placeholderPasswordHash = await bcrypt.hash(randomUUID(), 12);
      const createdUser = await client.query<{ id: string }>(
        "INSERT INTO users (id, email, password_hash, email_verified) VALUES ($1, $2, $3, true) RETURNING id",
        [newUserId, normalizedEmail, placeholderPasswordHash],
      );
      userId = createdUser.rows[0]?.id;
    } else {
      await client.query(
        "UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1",
        [userId],
      );
    }

    if (!userId) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `INSERT INTO profiles (id, user_id, email, full_name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) DO UPDATE
             SET email = EXCLUDED.email,
                 full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
                 updated_at = now()`,
      [randomUUID(), userId, normalizedEmail, fullName],
    );

    await client.query(
      `INSERT INTO user_roles (id, user_id, role)
             VALUES ($1, $2, 'staff')
             ON CONFLICT (user_id, role) DO NOTHING`,
      [randomUUID(), userId],
    );

    console.log("Upserting Google user:", { email: normalizedEmail, fullName });
    await client.query("COMMIT");
    const user = await getAuthUserById(userId);
    console.log("Upsert result user:", user);
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Google sign-in upsert failed:", error);
    return null;
  } finally {
    client.release();
  }
}

const googleClientId =
  process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
const googleProvider =
  googleClientId && googleClientSecret
    ? [
      Google({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      }),
    ]
    : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials?.password !== "string"
        ) {
          return null;
        }

        const email = normalizeEmail(credentials.email);
        const password = credentials.password;

        // Find user by email
        const user = await queryOne<DbCredentialUser>(
          "SELECT id, email, password_hash FROM users WHERE LOWER(email) = LOWER($1)",
          [email],
        );

        if (!user) {
          return null;
        }

        // Verify password
        let isValid = false;
        try {
          isValid = await bcrypt.compare(password, user.password_hash);
        } catch {
          return null;
        }

        if (!isValid) {
          return null;
        }

        const dbUser = await getAuthUserById(user.id);
        return dbUser ? mapDbUserToAuthUser(dbUser) : null;
      },
    }),
    ...googleProvider,
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("SignIn Callback started:", { provider: account?.provider, email: user.email });
      if (account?.provider !== "google") {
        return true;
      }

      const googleEmail =
        typeof user.email === "string" ? normalizeEmail(user.email) : "";
      if (!googleEmail) {
        console.warn("SignIn Callback: No google email found");
        return false;
      }

      const emailVerifiedValue = (
        profile as { email_verified?: boolean | string } | undefined
      )?.email_verified;
      console.log("Email verified value:", emailVerifiedValue);
      const isEmailVerified = Boolean(
        emailVerifiedValue === true || emailVerifiedValue === "true",
      );
      if (!isEmailVerified) {
        console.warn("SignIn Callback: Email not verified");
        return false;
      }

      console.log("Attempting upsert for:", googleEmail);
      const dbUser = await upsertGoogleUserByEmail(
        googleEmail,
        user.name ?? null,
      );
      if (!dbUser) {
        console.warn("SignIn Callback: upsertGoogleUserByEmail returned null");
        return false;
      }

      const mappedUser = mapDbUserToAuthUser(dbUser);
      user.id = mappedUser.id;
      user.email = mappedUser.email;
      user.name = mappedUser.name;
      user.roles = mappedUser.roles;
      user.departmentId = mappedUser.departmentId;

      console.log("SignIn Callback: Successful for", googleEmail);
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.departmentId =
          (user as { departmentId?: string }).departmentId ?? null;
      }

      const tokenEmail = typeof token.email === "string" ? token.email : null;
      const shouldHydrateToken =
        (!token.id || account?.provider === "google") && !!tokenEmail;

      if (shouldHydrateToken) {
        const dbUser = await getAuthUserByEmail(tokenEmail);
        if (dbUser) {
          token.id = dbUser.id;
          token.roles = dbUser.roles ?? [];
          token.departmentId = dbUser.department_id ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { roles?: string[] }).roles = token.roles as string[];
        (session.user as { departmentId?: string | null }).departmentId =
          token.departmentId as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
