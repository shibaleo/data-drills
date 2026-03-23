import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const result = await authenticate(req);
  if (!result) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.delete(oauthToken).where(eq(oauthToken.provider, "google"));

  return NextResponse.json({ ok: true });
}
