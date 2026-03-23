import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthToken, problemFile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getDriveClient } from "@/lib/google-oauth";

/**
 * GET /api/drive/file?id={gdrive_file_id}
 * Proxy PDF content from Google Drive through our server.
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("id");
  if (!fileId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const authResult = await authenticate(request);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tokens] = await db
    .select()
    .from(oauthToken)
    .where(eq(oauthToken.provider, "google"))
    .limit(1);

  if (!tokens) {
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 400 });
  }

  const { drive } = await getDriveClient({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_expires_at: tokens.tokenExpiresAt,
  });

  try {
    // Check if file is trashed
    const meta = await drive.files.get({ fileId, fields: "trashed" });
    if (meta.data.trashed) {
      await db.delete(problemFile).where(eq(problemFile.gdriveFileId, fileId));
      return NextResponse.json({ error: "File is in trash", deleted: true }, { status: 404 });
    }

    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );

    return new NextResponse(res.data as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 404) {
      await db.delete(problemFile).where(eq(problemFile.gdriveFileId, fileId));
      return NextResponse.json({ error: "File not found on Google Drive", deleted: true }, { status: 404 });
    }
    return NextResponse.json(
      { error: code === 401 || code === 403 ? "Google Drive auth failed" : "Failed to fetch file" },
      { status: code === 401 || code === 403 ? 401 : 500 },
    );
  }
}
