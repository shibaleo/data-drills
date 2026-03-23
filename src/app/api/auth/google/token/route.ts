import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOAuth2Client } from "@/lib/google-oauth";

/**
 * GET /api/auth/google/token
 * Return a fresh access_token for client-side Google Picker API.
 */
export async function GET(request: NextRequest) {
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

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
    expiry_date: tokens.tokenExpiresAt
      ? new Date(tokens.tokenExpiresAt).getTime()
      : undefined,
  });

  const { token } = await client.getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Failed to get access token" }, { status: 500 });
  }

  // Persist refreshed token if changed
  if (token !== tokens.accessToken) {
    await db
      .update(oauthToken)
      .set({
        accessToken: token,
        tokenExpiresAt: client.credentials.expiry_date
          ? new Date(client.credentials.expiry_date)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(oauthToken.id, tokens.id));
  }

  return NextResponse.json({ accessToken: token });
}
