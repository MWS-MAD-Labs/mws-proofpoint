import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { pool, queryOne } from "@/lib/db";
import { refreshAuthToken } from "@/lib/auth-token";
import { canonicalRoleScopeSql } from "@/lib/organization-access";

interface DbCredentialUser {
  id: string;
  email: string;
  password_hash: string;
}

interface DbAuthUser {
  id: string;
  email: string;
  full_name: string | null;
  department_ids: string[] | null;
  roles: string[] | null;
}

interface AppAuthUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  departmentId: string | null;
  departmentIds: string[];
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
    departmentId: user.department_ids?.length === 1 ? user.department_ids[0] : null,
    departmentIds: user.department_ids ?? [],
  };
}

async function getAuthUserById(userId: string) {
  return queryOne<DbAuthUser>(
    `SELECT
            u.id,
            u.email,
            p.full_name,
            COALESCE(
                ARRAY_AGG(DISTINCT dr.department_id::text) FILTER (WHERE dr.department_id IS NOT NULL),
                ARRAY[]::text[]
            ) AS department_ids,
            COALESCE(
                ARRAY_AGG(DISTINCT dr.role::text) FILTER (WHERE dr.role IS NOT NULL),
                ARRAY[]::text[]
            ) AS roles
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN department_role_memberships drm ON drm.user_id = u.id
         LEFT JOIN department_roles dr
           ON dr.id = drm.department_role_id
          AND ${canonicalRoleScopeSql("dr")}
         WHERE u.id = $1 AND u.status = 'active'
         GROUP BY u.id, p.full_name`,
    [userId],
  );
}

async function getAuthUserByEmail(email: string) {
  return queryOne<DbAuthUser>(
    `SELECT
            u.id,
            u.email,
            p.full_name,
            COALESCE(
                ARRAY_AGG(DISTINCT dr.department_id::text) FILTER (WHERE dr.department_id IS NOT NULL),
                ARRAY[]::text[]
            ) AS department_ids,
            COALESCE(
                ARRAY_AGG(DISTINCT dr.role::text) FILTER (WHERE dr.role IS NOT NULL),
                ARRAY[]::text[]
            ) AS roles
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN department_role_memberships drm ON drm.user_id = u.id
         LEFT JOIN department_roles dr
           ON dr.id = drm.department_role_id
          AND ${canonicalRoleScopeSql("dr")}
         WHERE LOWER(u.email) = LOWER($1) AND u.status = 'active'
         GROUP BY u.id, p.full_name`,
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
          "SELECT id, email, password_hash FROM users WHERE LOWER(email) = LOWER($1) AND status = 'active'", 
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
      user.departmentIds = mappedUser.departmentIds;

      console.log("SignIn Callback: Successful for", googleEmail);
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.departmentId =
          (user as { departmentId?: string | null }).departmentId ?? null;
        token.departmentIds =
          (user as { departmentIds?: string[] }).departmentIds ?? [];
      }

      const tokenEmail = typeof token.email === "string" ? token.email : null;
      return refreshAuthToken(
        token,
        async () => {
          const dbUser = token.id
            ? await getAuthUserById(String(token.id))
            : tokenEmail
              ? await getAuthUserByEmail(tokenEmail)
              : null;
          return dbUser
            ? {
                id: dbUser.id,
                roles: dbUser.roles,
                departmentId: dbUser.department_ids?.length === 1 ? dbUser.department_ids[0] : null,
                departmentIds: dbUser.department_ids ?? [],
              }
            : null;
        },
        (error) => console.error("Unable to refresh authenticated user; retaining current session token:", error),
      );
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { roles?: string[] }).roles = token.roles as string[];
        (session.user as { departmentId?: string | null }).departmentId =
          (token.departmentId as string | null | undefined) ?? null;
        (session.user as { departmentIds?: string[] }).departmentIds =
          (token.departmentIds as string[] | undefined) ?? [];
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
