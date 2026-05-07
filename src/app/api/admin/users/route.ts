import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import bcrypt from "bcrypt";

// Helper to check if user is admin
async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Unauthorized", status: 401 };
    }
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!roles.includes("admin")) {
        return { error: "Forbidden", status: 403 };
    }
    return { session };
}

// GET /api/admin/users - List all users with full details
export async function GET(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (userId) {
            // Get specific user with all details
            const user = await queryOne(
                `SELECT u.id, u.email, u.status, u.created_at,
                        p.full_name, p.niy, p.job_title, p.department_id,
                        d.name as department_name,
                        ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL) as roles
                 FROM users u
                 LEFT JOIN profiles p ON u.id = p.user_id
                 LEFT JOIN departments d ON p.department_id = d.id
                 LEFT JOIN user_roles ur ON u.id = ur.user_id
                 WHERE u.id = $1
                 GROUP BY u.id, p.id, d.name`,
                [userId]
            );
            return NextResponse.json({ data: user });
        }

        // Get all users with roles and department info
        const users = await query(
            `SELECT u.id, u.email, u.status, u.created_at,
                    p.full_name, p.niy, p.job_title, p.department_id,
                    d.name as department_name,
                    ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL) as roles
             FROM users u
             LEFT JOIN profiles p ON u.id = p.user_id
             LEFT JOIN departments d ON p.department_id = d.id
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             WHERE u.status != 'deleted'
             GROUP BY u.id, p.id, d.name
             ORDER BY p.full_name NULLS LAST`
        );

        return NextResponse.json({ data: users });
    } catch (error) {
        console.error("Admin users error:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}

// POST /api/admin/users - Create new user
export async function POST(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const { email, password, full_name, niy, job_title, department_id, roles } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password required" }, { status: 400 });
        }

        // Check if email already exists
        const existing = await queryOne(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );
        if (existing) {
            return NextResponse.json({ error: "Email already exists" }, { status: 409 });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await queryOne<{ id: string }>(
            `INSERT INTO users (id, email, password_hash, status) 
             VALUES ($1, $2, $3, 'active') 
             RETURNING id`,
            [randomUUID(), email, passwordHash]
        );

        if (!newUser) {
            return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
        }

        // Create profile
        await queryOne(
            `INSERT INTO profiles (id, user_id, email, full_name, niy, job_title, department_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [randomUUID(), newUser.id, email, full_name ?? null, niy ?? null, job_title ?? null, department_id ?? null]
        );

        // Assign roles (default to 'staff' if not specified)
        let rolesArray: string[] = ["staff"];
        if (roles) {
            if (Array.isArray(roles)) {
                rolesArray = roles.map(r => String(r).trim().toLowerCase()).filter(r => r.length > 0);
            } else if (typeof roles === "string" && roles.length > 0) {
                rolesArray = roles.replace(/[{}]/g, "").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
            }
        }

        // Final sanitization against valid roles
        const VALID_APP_ROLES = ["admin", "staff", "manager", "director", "supervisor"];
        rolesArray = rolesArray.filter(r => VALID_APP_ROLES.includes(r));

        if (rolesArray.length === 0) rolesArray = ["staff"];

        for (const role of rolesArray) {
            await queryOne(
                `INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3::public.app_role)`,
                [randomUUID(), newUser.id, role]
            );
        }

        // Return created user with full details
        const createdUser = await queryOne(
            `SELECT u.id, u.email, u.status, u.created_at,
                    p.full_name, p.niy, p.job_title, p.department_id,
                    d.name as department_name,
                    ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL) as roles
             FROM users u
             LEFT JOIN profiles p ON u.id = p.user_id
             LEFT JOIN departments d ON p.department_id = d.id
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             WHERE u.id = $1
             GROUP BY u.id, p.id, d.name`,
            [newUser.id]
        );

        return NextResponse.json({ data: createdUser }, { status: 201 });
    } catch (error) {
        console.error("Create user error:", error);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
}

// PUT /api/admin/users - Update user
export async function PUT(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        console.log("Update user body:", JSON.stringify(body, null, 2));
        const { id, full_name, niy, job_title, department_id, roles, password, status } = body;

        if (!id) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        // Validate department_id as UUID or null
        const finalDeptId = (department_id === "" || department_id === "none") ? null : department_id;

        // Update profile
        await queryOne(
            `UPDATE profiles 
             SET full_name = COALESCE($1, full_name),
                 niy = COALESCE($2, niy),
                 job_title = COALESCE($3, job_title),
                 department_id = $4,
                 updated_at = now()
             WHERE user_id = $5`,
            [full_name || null, niy || null, job_title || null, finalDeptId, id]
        );

        // Update password if provided
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            await queryOne(
                `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
                [passwordHash, id]
            );
        }

        // Update status if provided
        if (status) {
            await queryOne(
                `UPDATE users SET status = $1, updated_at = now() WHERE id = $2`,
                [status, id]
            );
        }

        // Update roles if provided
        if (roles) {
            let rolesArray: string[] = [];
            if (Array.isArray(roles)) {
                rolesArray = roles.map(r => String(r).trim().toLowerCase()).filter(r => r.length > 0);
            } else if (typeof roles === "string" && roles.length > 0) {
                rolesArray = roles.replace(/[{}]/g, "").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
            }

            // Final sanitization against valid roles
            const VALID_APP_ROLES = ["admin", "staff", "manager", "director", "supervisor"];
            rolesArray = rolesArray.filter(r => VALID_APP_ROLES.includes(r));

            if (rolesArray.length > 0) {
                // Remove existing roles
                await query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
                // Add new roles
                for (const role of rolesArray) {
                    await queryOne(
                        `INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3::public.app_role)`,
                        [randomUUID(), id, role]
                    );
                }
            }
        }

        // Return updated user
        const updatedUser = await queryOne(
            `SELECT u.id, u.email, u.status, u.created_at,
                    p.full_name, p.niy, p.job_title, p.department_id,
                    d.name as department_name,
                    ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL) as roles
             FROM users u
             LEFT JOIN profiles p ON u.id = p.user_id
             LEFT JOIN departments d ON p.department_id = d.id
             LEFT JOIN user_roles ur ON u.id = ur.user_id
             WHERE u.id = $1
             GROUP BY u.id, p.id, d.name`,
            [id]
        );

        return NextResponse.json({ data: updatedUser });
    } catch (error) {
        console.error("Update user error:", error);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

// DELETE /api/admin/users - Suspend/delete user (soft delete)
export async function DELETE(request: Request) {
    try {
        const adminCheck = await requireAdmin();
        if ("error" in adminCheck) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const permanent = searchParams.get("permanent") === "true";

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        // Prevent self-deletion
        if (userId === adminCheck.session.user.id) {
            return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
        }

        if (permanent) {
            // Hard delete - cascades to profiles and user_roles
            await query(`DELETE FROM users WHERE id = $1`, [userId]);
            return NextResponse.json({ message: "User permanently deleted" });
        } else {
            // Soft delete - just update status
            await queryOne(
                `UPDATE users SET status = 'suspended', updated_at = now() WHERE id = $1`,
                [userId]
            );
            return NextResponse.json({ message: "User suspended" });
        }
    } catch (error) {
        console.error("Delete user error:", error);
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
}
