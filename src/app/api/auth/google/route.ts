import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-oauth";

export async function GET(req: Request) {
  const result = await authenticate(req);
  if (!result) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}
