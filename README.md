# Smart Returns

A custom Shopify app for momina.co.uk that provides a smart, order-aware returns form. Customers enter their order number and email to automatically load their order details, select items to return with specific reasons, choose a refund preference, confirm policy requirements, and submit the request — which is emailed directly to the store team via Gmail SMTP.

## Prerequisites

- Node.js 18+
- A Shopify store with a custom app (Admin API access token with `read_orders` scope)
- A Gmail account with 2-Step Verification enabled and an App Password generated

## Setup

### 1. Create a Custom App in Shopify

1. Go to your Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**
2. Click **Create an app**, give it a name (e.g. "Smart Returns")
3. Under **Configuration** → **Admin API integration**, click **Configure**
4. Select the `read_orders` scope and save
5. Click **Install app** — confirm the installation
6. Under **API credentials**, copy:
   - **Admin API access token** (shown only once after install — save it securely)
   - **API key**
   - **API secret key**

### 2. Clone & Configure

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
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.gmail@gmail.com
SMTP_PASS=your_16_char_app_password
PORT=3000
```

### 3. Install Dependencies & Start

```bash
npm install
npm start
```

The app runs on `http://localhost:3000`.

### 4. Deploy to Production

Deploy to [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io). Set all environment variables in your hosting dashboard.

### 5. Configure App Proxy in Shopify

1. In Shopify Admin → **Settings** → **Apps and sales channels** → Smart Returns → **App proxy**
2. Set:
   - **Subpath prefix:** `apps`
   - **Subpath:** `returns`
   - **Proxy URL:** `https://your-deployed-app.com/proxy`
3. Save

### 6. Test

Visit `https://yourstore.com/apps/returns` — the returns form should appear inside your store theme.

---

## Gmail App Password

To use Gmail SMTP, you must generate an App Password (not your regular Gmail password):

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. **Security** → **2-Step Verification** (must be enabled first)
3. Scroll to the bottom → **App passwords**
4. Click **Create a new app password**, select app "Mail" and device "Other (Smart Returns)"
5. Copy the 16-character password — use this as `SMTP_PASS` in your `.env`

---

## Troubleshooting

**Blank page at `/apps/returns`**
Make sure `templates/returns-form.html` starts with `{% layout 'theme' %}` on the very first line, and that the route sets `Content-Type: application/liquid`.

**401 Unauthorized on page load**
Check that `SHOPIFY_API_SECRET` in your `.env` matches the API secret key from your Shopify app credentials page exactly.

**"Order not found" errors**
- Ensure the `read_orders` Admin API scope is granted (re-install the app if you added it after initial install)
- Confirm `SHOPIFY_ACCESS_TOKEN` is the current, valid access token
- Check `SHOP_DOMAIN` is in format `yourstore.myshopify.com` (no `https://`)

**Email not sending**
- Confirm Gmail 2-Step Verification is enabled on the account
- Verify `SMTP_PASS` is the App Password (16 characters, no spaces), not your regular Gmail password
- Check `SMTP_USER` matches the Gmail address used to generate the App Password

---

## File Structure

```
smart-returns/
├── server.js              # Express app entry point
├── package.json
├── .env.example           # Environment variable template
├── routes/
│   ├── proxy.js           # Serves the form HTML (application/liquid)
│   ├── lookupOrder.js     # POST /proxy/api/lookup-order
│   └── submitReturn.js    # POST /proxy/api/submit-return
├── middleware/
│   └── verifyProxy.js     # Shopify app proxy HMAC verification
├── templates/
│   └── returns-form.html  # Multi-stage returns form
└── utils/
    ├── shopify.js         # Shopify Admin API helper
    └── mailer.js          # Gmail SMTP via Nodemailer
```
