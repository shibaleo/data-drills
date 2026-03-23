import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { problemFile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/drive/link
 * Link a Google Drive file to a problem (upsert into problem_files).
 */
export async function POST(request: NextRequest) {
  const authResult = await authenticate(request);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { problemId, gdriveFileId, fileName } = body as {
    problemId: string;
    gdriveFileId: string;
    fileName: string;
  };
  if (!problemId || !gdriveFileId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Check if a file is already linked to this problem
  const existing = await db
    .select({ id: problemFile.id })
    .from(problemFile)
    .where(eq(problemFile.problemId, problemId))
    .limit(1);

  if (existing.length > 0) {
    // Update existing link
    await db
      .update(problemFile)
      .set({ gdriveFileId, fileName })
      .where(eq(problemFile.id, existing[0].id));
  } else {
    // Insert new link
    await db.insert(problemFile).values({
      problemId,
      gdriveFileId,
      fileName,
    });
  }

  return NextResponse.json({ ok: true, fileName });
}
