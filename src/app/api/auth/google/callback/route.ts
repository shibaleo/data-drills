import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { oauthToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { exchangeCode } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  try {
    const tokens = await exchangeCode(code);

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;

    // Upsert: update existing google token or insert new one
    const existing = await db
      .select({ id: oauthToken.id })
      .from(oauthToken)
      .where(eq(oauthToken.provider, "google"))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(oauthToken)
        .set({
          accessToken: tokens.access_token ?? "",
          refreshToken: tokens.refresh_token ?? null,
          tokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(oauthToken.id, existing[0].id));
    } else {
      await db.insert(oauthToken).values({
        provider: "google",
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
      });
    }

    return NextResponse.redirect(`${baseUrl}/?google=connected`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/?google=error`);
  }
}
