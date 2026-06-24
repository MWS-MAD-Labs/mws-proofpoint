import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";

export async function POST(request: Request) {
    try {
        // Check authentication
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/png",
            "image/jpeg",
            "image/gif",
            "text/plain",
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "File type not allowed" },
                { status: 400 }
            );
        }

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: "File too large (max 50MB)" },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to MinIO
        const result = await uploadFile(
            buffer,
            file.name,
            session.user.id,
            file.type
        );

        return NextResponse.json({
            success: true,
            key: result.key,
            url: result.url,
            fileName: file.name,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 }
        );
    }
}
