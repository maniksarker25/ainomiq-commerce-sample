# Ainomiq - Klaviyo OAuth App Overview

---

## 1. Customer Workflow

### Step 1: Discover & Install

The customer discovers Ainomiq through the Klaviyo App Marketplace. They click "Install App," which redirects to `https://app.ainomiq.com/api/auth/klaviyo/install`. If the user is not logged into Ainomiq, they are prompted to log in (or create an account) and then automatically redirected to the Klaviyo OAuth consent screen.

### Step 2: Authorize

The user reviews the requested OAuth scopes (accounts:read, campaigns:read, flows:read, metrics:read, profiles:read, segments:read) and clicks "Allow" on Klaviyo's consent screen. The authorization code is exchanged server-side using PKCE (S256) and stored securely.

### Step 3: Configure

After successful OAuth, the user is redirected to the Ainomiq Dashboard Settings page (`https://app.ainomiq.com/dashboard/settings`). The Klaviyo integration now shows as "Connected." The user can configure which Ainomiq modules to enable (AI Customer Support, Email Performance, Automations).

### Step 4: Use

Ainomiq begins syncing Klaviyo data (campaigns, flows, profiles, segments) to power:

- **Email Performance Dashboard** - real-time metrics for flows and campaigns
- **AI Customer Support** - automated email responses using Klaviyo profile data
- **Segment Insights** - subscriber engagement analysis for ad targeting

---

## 2. Integration Details

| Use Case                 | Klaviyo API Endpoint                                                  | Scope Required               | Description                                                   |
| ------------------------ | --------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| Display account info     | GET /api/accounts                                                     | accounts:read                | Show connected Klaviyo account name and ID in dashboard       |
| View campaign metrics    | GET /api/campaign-campaign-jobs, GET /api/campaign-recipient-activity | campaigns:read, metrics:read | Display open rates, click rates, revenue per campaign         |
| View flow performance    | GET /api/flows, GET /api/flow-series                                  | flows:read, metrics:read     | Show automated flow metrics, revenue attribution              |
| Profile data for support | GET /api/profiles                                                     | profiles:read                | Look up customer profiles to personalize AI support responses |
| Segment analysis         | GET /api/lists, GET /api/segments                                     | segments:read                | Display subscriber segments and engagement for ad targeting   |
| Revenue tracking         | GET /api/metric-aggregate                                             | metrics:read                 | Query revenue and conversion metrics over time                |

---

## 3. Architectural Diagram

```
┌─────────────┐     OAuth 2.0 + PKCE     ┌──────────────┐
│   Klaviyo    │ ◄──────────────────────► │   Ainomiq    │
│  (Provider)  │                          │  (Consumer)  │
└──────┬───────┘                          └──────┬───────┘
       │                                         │
       │  API Requests (Bearer token)            │
       │  GET /api/campaigns                     │
       │  GET /api/flows                         │
       │  GET /api/profiles                      │
       │  GET /api/segments                      │
       │  GET /api/metric-aggregate              │
       │                                         │
       │                                 ┌───────┴───────┐
       │                                 │  PostgreSQL   │
       │                                 │  - OAuth tokens│
       │                                 │  - Cached data │
       │                                 │  - User config │
       │                                 └───────────────┘
       │
       │  Data flows ONE-WAY (read only)
       │  Ainomiq does NOT write to Klaviyo
```

**Token Storage:** OAuth tokens are encrypted at rest in PostgreSQL. Tokens are refreshed automatically before expiry. Tokens are never exposed to client-side code.

**Data Flow:** All API calls are made server-side. Ainomiq only READS data from Klaviyo - no profiles, campaigns, or flows are modified.

---

## 4. Product Integration Demo

A recorded demo video is available at: [to be recorded and linked]

**Demo outline:**

1. User navigates to Klaviyo App Marketplace
2. Finds and clicks "Install" on Ainomiq
3. Logs into Ainomiq (or creates account)
4. Reviews OAuth scopes on Klaviyo consent screen
5. Clicks "Allow" - redirected to Ainomiq dashboard
6. Settings page shows Klaviyo as "Connected"
7. User navigates to Email Performance module - sees live flow/campaign data
8. User navigates to AI Customer Support - sees it using Klaviyo profile data
9. User can disconnect Klaviyo from Settings → token is revoked

---

## 5. Testing Details

### Test Account

**Create your own account:**

1. Go to https://app.ainomiq.com/register
2. Sign up with any email address
3. Navigate to Settings → Integrations
4. Click "Connect" on Klaviyo
5. You'll be redirected to Klaviyo OAuth

**Or use provisioned test account:**

- Email: [Pim to provide]
- Password: [Pim to provide]

### Testing the Install Flow (from Klaviyo)

1. In Klaviyo App Marketplace, find Ainomiq and click "Install App"
2. If not logged in → redirected to Ainomiq login page
3. Log in → automatically redirected to Klaviyo OAuth consent screen
4. Review scopes and click "Allow"
5. Redirected to Ainomiq Settings with Klaviyo connected

### Testing Disconnect

1. Go to https://app.ainomiq.com/dashboard/settings
2. Find Klaviyo integration
3. Click "Disconnect"
4. OAuth token is revoked, cached data is cleared

### OAuth Scopes Explanation

| Scope          | Why We Need It                                                |
| -------------- | ------------------------------------------------------------- |
| accounts:read  | Display the connected Klaviyo account name in our dashboard   |
| campaigns:read | Show email campaign performance (open rates, clicks, revenue) |
| flows:read     | Display automated flow metrics and revenue attribution        |
| metrics:read   | Query aggregate metrics for dashboards and reports            |
| profiles:read  | Look up customer profiles to personalize AI support responses |
| segments:read  | Display subscriber segments for targeting and analysis        |

### Data Deletion

- On disconnect: OAuth token is immediately revoked
- On account deletion: All cached Klaviyo data is purged within 24 hours
- Data deletion webhook: https://app.ainomiq.com/api/data-deletion

---

## Contact

- **Company:** Ainomiq B.V.
- **Email:** support@ainomiq.com
- **Website:** https://ainomiq.com
