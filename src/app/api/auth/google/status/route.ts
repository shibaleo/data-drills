import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const result = await authenticate(req);
  if (!result) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ id: oauthToken.id, updatedAt: oauthToken.updatedAt })
    .from(oauthToken)
    .where(eq(oauthToken.provider, "google"))
    .limit(1);

  return NextResponse.json({
    connected: rows.length > 0,
    updatedAt: rows[0]?.updatedAt ?? null,
  });
}
