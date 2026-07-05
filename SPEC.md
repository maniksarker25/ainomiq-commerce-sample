# Ainomiq Integrations Backend - Spec

## Doel

Backend API die OAuth flows afhandelt voor het Ainomiq klant-dashboard. Klanten klikken "Connect" op hun dashboard, worden doorgestuurd naar het platform, authoriseren, en de token wordt veilig opgeslagen.

## Tech Stack

- Next.js (API routes)
- SQLite (via better-sqlite3) voor token opslag - simpel, geen externe DB nodig
- Draait op de Mac mini, exposed via Tailscale

## OAuth Integrations

### 1. Shopify

- Client ID: 8675ddab7733afe899b27f904b528cc2
- Client Secret: [REDACTED — stored in environment variables and `vault.md`]
- Flow: OAuth 2.0 authorization code grant
- Redirect: https://ainomiq.com/api/auth/shopify/callback
- Scopes (requested in auth URL): read_products,read_orders,read_customers,read_inventory,read_analytics,read_fulfillments,read_shipping,write_discounts,write_gift_cards,write_orders

### 2. Meta (Facebook/Instagram)

- App ID: 1456384356160440
- App Secret: [REDACTED — stored in environment variables and `vault.md`]
- Flow: OAuth 2.0 (Facebook Login + Marketing API)
- Redirect: https://app.ainomiq.com/api/auth/meta/callback
- Scopes: ads_read,ads_management,read_insights,pages_read_engagement

### 3. Klaviyo

- Client ID: ac952070-0c1d-499d-86a3-b4c9b74b17a7
- Client Secret: [REDACTED — stored in environment variables and `vault.md`]
- Flow: OAuth 2.0 with PKCE
- Redirect: https://ainomiq.com/api/auth/klaviyo/callback
- Scopes: all read scopes (accounts:read, campaigns:read, flows:read, metrics:read, profiles:read, segments:read, etc.)

### 4. Google (Analytics, Ads, Gmail, Calendar)

- Client ID: 510580966859-6oqd56b8f1voo0keebcr0s6vf10fdmke.apps.googleusercontent.com
- Client Secret: [REDACTED — stored in environment variables and `vault.md`]
- Flow: OAuth 2.0 authorization code grant
- Redirect: https://ainomiq.com/api/auth/google/callback
- Scopes: https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly

## Database Schema (SQLite)

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL, -- shopify, meta, klaviyo, google
  access_token TEXT NOT NULL, -- encrypted
  refresh_token TEXT, -- encrypted
  token_expires_at DATETIME,
  scopes TEXT,
  provider_account_id TEXT, -- e.g. Shopify shop domain, Meta ad account ID
  status TEXT DEFAULT 'active', -- active, expired, revoked
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, provider)
);
```

## API Routes

### OAuth Flows

- `GET /api/auth/[provider]/connect?tenant_id=X` - Initiates OAuth, redirects to provider
- `GET /api/auth/[provider]/callback` - Handles callback, stores token, redirects to dashboard
- `POST /api/auth/[provider]/disconnect` - Revokes token, removes from DB
- `GET /api/auth/[provider]/status?tenant_id=X` - Returns connection status

### Integration Data (for dashboard)

- `GET /api/integrations?tenant_id=X` - List all integrations for tenant with status

## Security Requirements

1. **Token encryption**: All access/refresh tokens encrypted at rest (AES-256-GCM)
2. **ENCRYPTION_KEY**: env var, generated once, stored in vault.md
3. **State parameter**: All OAuth flows use random state param stored in session to prevent CSRF
4. **HTTPS only**: All redirects over HTTPS
5. **Token refresh**: Auto-refresh expired tokens where supported (Google, Klaviyo)
6. **Minimal scopes**: Only request what's needed
7. **No tokens in URLs**: Tokens never exposed in frontend/URL params
8. **Rate limiting**: Basic rate limiting on API routes
9. **Tenant isolation**: One tenant can never see another's data

## Frontend Update

After backend works, update the Shopify Liquid dashboard (ainomiq-dashboard.liquid) Integrations tab:

- Connect buttons link to `/api/auth/[provider]/connect?tenant_id=X`
- Status shown based on `/api/integrations?tenant_id=X` response
- Disconnect buttons call `/api/auth/[provider]/disconnect`

## Testing

- For development, use ainomiq.com with password page (not public)
- Test with Billie Jeans as first tenant (pimsmit@billiejeans.eu)
- Verify each OAuth flow end-to-end
- Test token refresh
- Test disconnect/reconnect
- Test error states (denied permission, expired token)

## Notes

- Domain ainomiq.com is on Shopify (ufmq6i-ir.myshopify.com)
- The backend needs to run separately (not on Shopify)
- For dev: run on Mac mini port 3001, expose via Tailscale
- For prod: deploy to Vercel or keep on Mac mini behind Tailscale Funnel
- NEVER edit the live Shopify theme (role=main) without checking first via API
