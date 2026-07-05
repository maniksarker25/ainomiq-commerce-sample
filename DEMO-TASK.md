# TASK: Build Demo Dashboard for info@ainomiq.com

## Context
This is a Next.js app deployed on Vercel (app.ainomiq.com). It's a SaaS dashboard where ecommerce businesses connect their platforms (Shopify, Meta, Klaviyo, Google) and get modules like Stock Management, Customer Service, Ads monitoring, Email marketing analytics, Performance overview, Analytics, and Automations.

## Database
Turso (libsql) remote DB. The connection is already configured in the API routes via createClient.

Current DB state:
- Tenant exists: id=1bf4adc6-3a0b-4a62-8bb8-2079f6e13e5d, name=Bink Sanders, email=info@ainomiq.com
- Has org config: organization=ainomiq
- Has ONE integration: meta (active) - THIS SHOULD BE REMOVED so everything starts disconnected
- NO password set, NO modules config

## What to build

### 1. Set up demo tenant in DB (write a setup script)
Create a script `scripts/setup-demo.ts` that:
- Sets password for info@ainomiq.com (use 'ainomiq2026', hash with pbkdf2 same as register route)
- Adds modules config: ALL modules ['stock', 'cs', 'ads', 'email', 'performance', 'analytics', 'automations']
- Removes existing meta integration so everything starts disconnected
- Run this script once

### 2. Demo mode detection
Create `lib/demo.ts` with:
- `isDemoTenant(email: string): boolean` - returns true for info@ainomiq.com
- Export the DEMO_EMAIL constant

### 3. Fake Connect flow (NO real OAuth)
When demo tenant clicks 'Connect' on any platform:
- Instead of redirecting to OAuth provider, directly insert a fake integration record in DB
- Set fake provider_account_id (e.g., 'demo-store.myshopify.com')
- Set fake tokens (placeholder strings)
- Redirect back to dashboard
- Modify ALL /api/auth/[provider]/connect routes
- Status and disconnect endpoints work normally (they use the integrations table)

### 4. Fake data for ALL modules
Create `lib/demo-data.ts` with realistic fake data generators.

Then modify EVERY API endpoint to check isDemoTenant and return fake data:

**Stock (/api/stock/stats, /api/stock/products):**
- 15-20 products with variants, SKUs, inventory levels
- Mix of in-stock, low-stock, out-of-stock
- Generic ecommerce product names

**CS (/api/cs/emails, /api/cs/stats, /api/cs/labels, /api/cs/email/[id]):**
- 10-15 email threads (mix read/unread)
- Realistic subjects and bodies
- Stats with realistic numbers

**Ads (/api/ads/stats, /api/ads/insights, /api/ads/campaigns, /api/ads/persona-stats, /api/ads/ad-performance, /api/ads/agent-status):**
- Realistic spend, ROAS, purchases, CPC
- Campaign list with metrics
- Persona breakdown by age/gender

**Email (/api related endpoints for Klaviyo):**
- Fake flows and campaigns
- Subscriber stats, open/click rates

**Shopify stats (/api/shopify/stats):**
- Revenue, orders, customers data

**Performance page:**
- This page fetches platform statuses and summary data
- Return fake stats per platform

### 5. Critical rules
- Keep ALL existing code working for real tenants
- All integrations start DISCONNECTED for demo
- Connect = instant fake connection + data appears
- Disconnect = removes record, goes back to disconnected
- Make data look like a successful mid-size ecommerce store
- Monochrome branding (black/white/gray), no emojis

### 6. After changes
- Test with `npm run dev` to verify it compiles
- Deploy with `vercel --prod` if vercel CLI is available
- If not, just commit changes

### 7. Notify when done
Run: `openclaw system event --text "Done: Demo dashboard built for info@ainomiq.com" --mode now`

### 8. EXTRA REQUIREMENT (added by Kai)
NOTHING may be empty. Every single dashboard page and module must show realistic mock data when the demo tenant is logged in:
- Performance: revenue chart with daily data points, all KPIs filled
- Stock: full product list with inventory levels, low stock alerts
- CS: email threads with full bodies, stats, labels
- Ads: campaigns, ad sets, individual ads, persona stats, agent status
- Email: flows, campaigns, subscriber stats, open/click rates
- Analytics: all charts and metrics populated
- Automations: active automations list with status
- Settings: show all platforms as connectable
- Overview dashboard: all cards filled with data

Test EVERY page after building. If any page shows empty state or "Connect to see data", fix it.
The demo account should look like a thriving mid-size ecommerce store with 6 months of history.

Also: the demo tenant's integrations should start PRE-CONNECTED (all platforms connected with fake records in DB), so the user sees data immediately on first login. No need to click Connect first.
