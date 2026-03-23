import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

export function getOAuth2Client() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/auth/google/callback`,
  );
}

export function getAuthUrl() {
  return getOAuth2Client().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCode(code: string) {
  const { tokens } = await getOAuth2Client().getToken(code);
  return tokens;
}

/**
 * Get an authenticated Google Drive client using stored tokens.
 */
export async function getDriveClient(tokens: {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | Date | null;
}) {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.token_expires_at
      ? new Date(tokens.token_expires_at).getTime()
      : undefined,
  });

  const { token } = await client.getAccessToken();
  const drive = google.drive({ version: "v3", auth: client });
  return { drive, accessToken: token, client };
}
