export type EbayEnv = {
  EBAY_CLIENT_ID: string;
  EBAY_CLIENT_SECRET: string;
};

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const BROWSE_BASE = "https://api.ebay.com/buy/browse/v1";

let cachedToken: { token: string; exp: number } | null = null;

function basicAuth(clientId: string, clientSecret: string) {
  const raw = `${clientId}:${clientSecret}`;
  // btoa is available in Workers runtime
  return `Basic ${btoa(raw)}`;
}

export async function getAppToken(env: EbayEnv): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.token;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", "https://api.ebay.com/oauth/api_scope");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET),
    },
    body,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`eBay token error: ${res.status} ${t}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + json.expires_in * 1000 };
  return cachedToken.token;
}

export function browseUrl(path: string) {
  return `${BROWSE_BASE}${path}`;
}
