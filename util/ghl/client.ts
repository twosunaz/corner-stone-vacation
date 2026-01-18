const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const GHL_PRIVATE_KEY = process.env.GHL_PRIVATE_INTEGRATION_KEY!;

export async function ghlApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_PRIVATE_KEY}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `GHL API error ${res.status}: ${text}`
    );
  }

  return res.json();
}
