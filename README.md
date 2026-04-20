# Smart Returns

A custom Shopify app for momina.co.uk that provides an order-aware returns form embedded inside the store theme. Customers enter their order number and email to automatically load their order details, select items to return with specific reasons, choose a refund preference, confirm policy requirements, and submit — triggering both an admin notification email and a branded customer confirmation email.

---

## Features

- **Order lookup** — customers enter order number + email; Shopify Admin API fetches real order data
- **Multi-stage form** — order lookup → item selection + reasons → refund preference → policy confirmation → success
- **Delivery tracking** — on order load, the app queries the Royal Mail Tracking API V2 to determine delivery date; if delivered within 14 days the return proceeds, if outside the window it is blocked. Falls back to a manual checkbox if tracking cannot be verified.
- **Returns rate check** — on order load, the app calculates the customer's historical return rate across all Shopify orders (by customer ID + email, to catch both account and guest checkout orders). If the rate exceeds 40% and the customer has placed 4 or more orders, the return form is blocked and they are directed to contact the store.
- **Admin email** — formatted HTML email sent to the store team on every submission
- **Customer confirmation email** — branded reply sent automatically to the customer; message body is customisable via the admin dashboard
- **Admin dashboard** — lists all submissions with search, accordion detail view, direct Shopify order link, SKU display, returns rate indicator, and action dropdown
- **WYSIWYG email editor** — Quill.js rich-text editor in the dashboard for composing the customer reply template; includes raw HTML source toggle and Save button
- **Theme integration** — form renders inside the Shopify storefront theme via App Proxy + Liquid layout
- **Email via Brevo** — uses Brevo REST API (no SMTP ports required); sender domain authenticated with DKIM/DMARC

---

## Prerequisites

- Node.js 18+
- A Shopify store with a custom app (Admin API access token with `read_orders` and `read_all_orders` scopes)
- A [Brevo](https://www.brevo.com) account with an API key and authenticated sending domain
- A Royal Mail developer account with Tracking API V2 credentials (Client ID + Client Secret), subscribed to the Assessment or production plan

---

## Setup

### 1. Create a Custom App in Shopify

1. Go to Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**
2. Click **Create an app**, give it a name (e.g. "Smart Returns")
3. Under **Configuration** → **Admin API integration**, click **Configure**
4. Select the following scopes and save:
   - `read_orders`
   - `read_all_orders` ← required to access orders older than 60 days (needed for returns rate calculation)
5. Click **Install app** — confirm the installation
6. Under **API credentials**, copy:
   - **Admin API access token** (shown only once — save it securely)
   - **API key**
   - **API secret key**

### 2. Configure App Proxy in Shopify Partner Dashboard

1. Open your app in the [Shopify Partner Dashboard](https://partners.shopify.com)
2. Go to **App setup** → **App proxy**
3. Set:
   - **Subpath prefix:** `tools`
   - **Subpath:** `returns`
   - **Proxy URL:** `https://your-deployed-app.com/proxy`
4. Save, then **reinstall the app** on your store for the proxy URL to take effect

> **Important:** Any time you change the subpath prefix in the Partner Dashboard, you must reinstall the app — the proxy URL is registered at install time and does not update on existing installs.

### 3. Set Up Royal Mail Tracking API

1. Log in to [developer.royalmail.net](https://developer.royalmail.net)
2. Go to **My Apps** and create a new application — you will receive a **Client ID** and **Client Secret**
3. Subscribe your app to the **Royal Mail Tracking V2** product (Assessment plan for testing — contact your Royal Mail account manager to enable)
4. Note: the Assessment plan allows 25 calls per 12 hours. For production volume, request a higher-limit plan through your RM account manager.

> **Note:** The Royal Mail Tracking API is only available to Royal Mail business account (OBA) customers. The API plan subscription must be enabled by your RM account manager — it cannot be self-subscribed from the developer portal.

### 4. Clone & Configure

```bash
git clone <this-repo>
cd smart-returns
cp .env.example .env
```

Edit `.env` and fill in all values:

```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret_key
SHOPIFY_ACCESS_TOKEN=your_admin_api_access_token
SHOP_DOMAIN=yourstore.myshopify.com
RETURNS_EMAIL=returns@yourstore.com
BREVO_API_KEY=your_brevo_api_key
ADMIN_SECRET=a_secret_token_for_admin_access
APP_URL=https://your-deployed-app.com
PORT=3000

# Royal Mail Tracking API
ROYAL_MAIL_CLIENT_ID=your-client-id
ROYAL_MAIL_CLIENT_SECRET=your-client-secret
```

### 5. Install Dependencies & Start

```bash
npm install
npm start
```

The app runs on `http://localhost:3000`.

### 6. Deploy to Production

Deploy to your server or a platform such as [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io). Set all environment variables in your hosting dashboard or `.env` file.

> **Shared hosting note:** Ensure your hosting provider allows outbound HTTPS connections to `api.royalmail.net`. Some shared hosts block outbound connections to unfamiliar domains — contact support if you see `ENOTFOUND` or `ECONNREFUSED` errors for that domain.

---

## Accessing the App

| URL | Description |
|-----|-------------|
| `https://yourstore.com/tools/returns` | Customer-facing returns form (embedded in theme) |
| `https://your-app.com/?token=ADMIN_SECRET` | Admin dashboard (direct browser access) |
| `https://yourstore.com/admin/apps/smart-returns` | Admin dashboard (embedded in Shopify admin) |

---

## Admin Dashboard

The admin dashboard is served at the app root (`/`) and is accessible either:
- **Embedded in Shopify admin** — loaded automatically via Shopify's HMAC verification
- **Direct browser access** — append `?token=YOUR_ADMIN_SECRET` to the app URL

### Features

- **Submissions list** — all return requests, most recent first
- **Accordion cards** — click to expand and see full submission detail
- **Direct order link** — order number links directly to the order in Shopify admin (opens in new tab)
- **SKU display** — each returned item shows its variant and SKU
- **Search** — filter by order number, customer name, or email
- **Returns rate** — shows the customer's historical return rate (e.g. `8% (1 of 12 items)`) calculated from all Shopify orders. A refresh icon (↻) allows recalculating at any time for open submissions.
- **Action dropdown** — Re-send Admin Email / Complete Process / Cancel Request, replacing individual buttons to prevent accidental actions
- **Customer reply template editor** — click the **Reply Template** button in the header to open the WYSIWYG editor; toggle `</> HTML` for raw source editing; click **Save Template**

### Returns Rate

The returns rate is automatically calculated when a new submission is received. For older submissions without it, a **Load Returns Rate** button appears. The rate is stored against the submission in `data/submissions.json` once loaded.

Calculation logic:
- Fetches all orders by **customer ID** (account orders) and by **email** (guest checkout orders), merged and deduplicated
- **Total ordered** = sum of line item quantities on non-cancelled orders
- **Total returned** = sum of quantities on refund line items where `restock_type` is `return` or `legacy_restock` (physical returns only — goodwill refunds with `no_restock` are excluded)
- Requires the `read_all_orders` Shopify scope to access orders older than 60 days

### Customer Reply Template

The template is stored in `data/customer-email-template.json` (two formats: `html` for email delivery, `quillHtml` for re-loading in the editor). The customer email is sent automatically on every new submission using the saved template.

---

## Returns Form — Eligibility Checks

Two automatic checks run when a customer looks up their order:

### 1. Delivery Date Check (Royal Mail)
- Fetches fulfillment tracking from the Shopify order
- Queries Royal Mail Tracking API V2 for the delivery date
- If delivered **within 14 days**: return proceeds
- If delivered **more than 14 days ago**: return is blocked
- If tracking cannot be verified (API error, non-tracked service, DPD, UPS): falls back to a manual checkbox asking the customer to confirm delivery was within 14 days

### 2. Returns Rate Check
- Calculates the customer's return rate across all historical orders
- If rate is **above 40%** and the customer has placed **4 or more orders**: the return form is blocked and the customer is directed to the contact page
- The 4-order minimum prevents a single early return from unfairly triggering the block

---

## Email Sending (Brevo)

Emails are sent via the [Brevo](https://www.brevo.com) REST API:

- **From:** `MOMINA Designer Outfit Collection <info@momina.co.uk>`
- **Admin notification:** sent to `RETURNS_EMAIL` with customer email as reply-to
- **Customer confirmation:** sent to the customer with `RETURNS_EMAIL` as reply-to

To set up Brevo:
1. Create an account at [brevo.com](https://www.brevo.com)
2. Go to **SMTP & API** → **API Keys** → generate a key and set it as `BREVO_API_KEY`
3. Go to **Senders & IPs** → **Domains** → authenticate your sending domain with DKIM and DMARC records

---

## Troubleshooting

**Blank page at `/tools/returns`**
Ensure `templates/returns-form.html` starts with `{% layout 'theme' %}` on line 1, and that the proxy route sets `Content-Type: application/liquid`.

**Form returns 404 on API calls**
The frontend fetches `/tools/returns/api/lookup-order` and `/tools/returns/api/submit-return`. If you change the App Proxy subpath prefix, update these URLs in `templates/returns-form.html` to match, then reinstall the app.

**401 Unauthorized on page load**
Check that `SHOPIFY_API_SECRET` in your `.env` matches the API secret key from your Shopify app credentials page exactly.

**"Order not found" errors**
- Ensure the `read_orders` and `read_all_orders` Admin API scopes are granted (reinstall the app if you added them after initial install)
- Confirm `SHOPIFY_ACCESS_TOKEN` is the current, valid access token
- Check `SHOP_DOMAIN` is in the format `yourstore.myshopify.com` (no `https://`)

**Returns rate only shows recent orders**
The `read_all_orders` scope is required. Add it under Shopify Admin → Settings → Apps and sales channels → Develop apps → your app → Configuration → Admin API access scopes.

**Royal Mail tracking returns `ENOTFOUND`**
Your hosting provider may be blocking outbound DNS resolution for `api.royalmail.net`. Contact their support and ask them to allow outbound HTTPS to that domain.

**Royal Mail tracking returns 401**
- Verify `ROYAL_MAIL_CLIENT_ID` and `ROYAL_MAIL_CLIENT_SECRET` in your `.env` are correct
- Confirm your app is subscribed to the Tracking V2 product in the Royal Mail developer portal — this must be enabled by your RM account manager

**Admin dashboard shows "Network Error" on re-send / save template**
The admin dashboard uses absolute URLs constructed from `APP_URL`. Ensure `APP_URL` is set correctly in your `.env` (e.g. `https://smartreturns.rajaakhtar.com`).

**Email not sending**
- Confirm `BREVO_API_KEY` is valid and has sending permissions
- Ensure the sending domain (`info@momina.co.uk`) is authenticated in Brevo with DKIM/DMARC
- Check server logs for the exact Brevo API error response

**Save template blocked (403)**
Template saves go through `/admin-resend` with `action: save-template` to avoid server-level path filtering. Do not change this routing.

**App proxy URL not updating after changing subpath prefix**
You must reinstall the app — uninstall from Shopify Admin → Settings → Apps, then reinstall via the Partner Dashboard install URL.

---

## File Structure

```
smart-returns/
├── server.js                        # Express app entry point, route registration
├── package.json
├── .env.example                     # Environment variable template
├── routes/
│   ├── proxy.js                     # GET /proxy — serves returns form (Content-Type: application/liquid)
│   ├── lookupOrder.js               # POST /proxy/api/lookup-order — order fetch + eligibility checks
│   ├── submitReturn.js              # POST /proxy/api/submit-return
│   ├── admin.js                     # GET / — admin dashboard (HMAC or token auth)
│   ├── adminResend.js               # POST /admin-resend — resend email + save template
│   └── adminReturnsRate.js          # POST /admin-returns-rate — load/refresh returns rate
├── middleware/
│   ├── verifyProxy.js               # Shopify app proxy HMAC verification
│   └── checkOrigin.js               # Origin restriction for API routes
├── templates/
│   ├── returns-form.html            # Multi-stage returns form (Liquid template)
│   └── admin-dashboard.html         # Admin dashboard with Quill.js editor
├── utils/
│   ├── shopify.js                   # Shopify Admin API helper
│   ├── mailer.js                    # Email sending via Brevo REST API
│   ├── emailBuilder.js              # Builds admin notification HTML email
│   ├── customerEmailBuilder.js      # Builds customer confirmation HTML email
│   └── returnsRate.js               # Calculates customer return rate from Shopify order history
├── services/
│   └── tracking/
│       ├── index.js                 # Main checkDeliveryStatus() export
│       ├── carrierDetector.js       # Detects carrier from tracking company/number
│       ├── tokenCache.js            # In-memory OAuth token cache
│       └── carriers/
│           ├── royalMail.js         # Royal Mail Tracking API V2 integration
│           ├── ups.js               # UPS fallback handler
│           └── dpd.js               # DPD fallback handler
└── data/                            # Runtime data (git-ignored)
    ├── submissions.json             # All return submissions
    └── customer-email-template.json # Saved customer reply template (html + quillHtml)
```
