import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Current and new password are required" },
                { status: 400 }
            );
        }

        // Get user's current password hash
        const user = await queryOne<{ password_hash: string }>(
            "SELECT password_hash FROM users WHERE id = $1",
            [session.user.id]
        );

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValid) {
            return NextResponse.json(
                { error: "Incorrect current password" },
                { status: 400 }
            );
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 12);

        // Update password
        await query(
            "UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2",
            [newPasswordHash, session.user.id]
        );

        return NextResponse.json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Password update error:", error);
        return NextResponse.json(
            { error: "Failed to update password" },
            { status: 500 }
        );
    }
}
