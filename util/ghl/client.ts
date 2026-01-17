const GHL_OAUTH_URL = "https://services.leadconnectorhq.com/oauth/token";

// Load these from environment variables
const CLIENT_ID = process.env.GHL_CLIENT_ID!;
const CLIENT_SECRET = process.env.GHL_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GHL_REDIRECT_URI!;
const REFRESH_TOKEN = process.env.GHL_REFRESH_TOKEN!;

interface GHLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

// --- Get a new access token using refresh token ---
export async function getGHLAccessToken(): Promise<string> {
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      refresh_token: REFRESH_TOKEN,
    });

    const res = await fetch(GHL_OAUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get GHL token: ${res.status} ${text}`);
    }

    const data: GHLTokenResponse = await res.json();
    return data.access_token;
  } catch (err) {
    console.error("❌ getGHLAccessToken error:", err);
    throw err;
  }
}

// --- Helper for making authenticated API calls ---
export async function ghlApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getGHLAccessToken();

  const res = await fetch(`https://rest.gohighlevel.com/v1/${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API request failed: ${res.status} ${text}`);
  }

  return res.json();
}
