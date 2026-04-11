/**
 * Shopify Admin API utility.
 * Dev Dashboard apps use the client credentials grant — no static token.
 * We fetch a token using Client ID + Secret, cache it, and auto-refresh before expiry.
 */

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Fetches a fresh access token from Shopify using the client credentials grant.
 */
async function getAccessToken() {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const response = await fetch(
    `https://${process.env.SHOP_DOMAIN}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token error: ${response.status} ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Makes an authenticated GET request to the Shopify Admin API.
 * @param {string} endpoint - e.g. '/orders.json?name=1042&status=any'
 */
async function shopifyFetch(endpoint) {
  const token = await getAccessToken();
  const url = `https://${process.env.SHOP_DOMAIN}/admin/api/2026-04${endpoint}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

module.exports = { shopifyFetch };
