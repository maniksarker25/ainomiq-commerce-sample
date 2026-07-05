# Ainomiq - Klaviyo App Review Instructions

## What is Ainomiq?

Ainomiq is an AI-powered automation platform for e-commerce brands. The Klaviyo integration enables:

- **Email performance analytics** - view flow and campaign metrics (open rates, click rates, revenue) directly in the Ainomiq dashboard
- **AI Customer Support** - automated email responses using Klaviyo profile data for personalization
- **Segment insights** - view subscriber segments and engagement data for better targeting

## Testing Account

We have provisioned a test account for your review team:

- **Email:** (to be filled - Pim will provide)
- **Password:** (to be filled - Pim will provide)
- **URL:** https://app.ainomiq.com

Alternatively, you can create your own account at https://app.ainomiq.com/register.

## How to Test the Installation Flow

### Method 1: From Klaviyo (Install URL)

1. Go to the Klaviyo App Marketplace and find the Ainomiq listing
2. Click "Install App"
3. If not logged in, you'll be redirected to the Ainomiq login page
4. Log in (or create an account)
5. You'll be redirected to Klaviyo's OAuth consent screen
6. Review the requested scopes and click "Allow"
7. You'll be redirected back to the Ainomiq dashboard with Klaviyo connected

### Method 2: From Ainomiq Dashboard

1. Log in at https://app.ainomiq.com
2. Go to Settings (https://app.ainomiq.com/dashboard/settings)
3. Find the Klaviyo integration card
4. Click "Connect"
5. You'll be redirected to Klaviyo's OAuth consent screen
6. Review and click "Allow"
7. You'll be redirected back to Settings with Klaviyo connected

## OAuth Scopes Used

| Scope            | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `accounts:read`  | Access account info to display Klaviyo account name in dashboard |
| `campaigns:read` | View email campaign performance data                             |
| `flows:read`     | View automated flow metrics and revenue attribution              |
| `metrics:read`   | Access email metrics (opens, clicks, unsubscribes)               |
| `profiles:read`  | Access subscriber data for AI customer support personalization   |
| `segments:read`  | View subscriber segments for targeting insights                  |

## Settings URL

**URL:** https://app.ainomiq.com/dashboard/settings

From Settings, users can:

- View connected integrations (including Klaviyo)
- Disconnect Klaviyo (revokes OAuth token)
- Reconnect if needed

## Install URL

**URL:** https://app.ainomiq.com/api/auth/klaviyo/install

This URL handles the full OAuth flow:

- Checks if user is logged in (via JWT cookie)
- If logged in → redirects directly to Klaviyo OAuth authorize URL
- If not logged in → redirects to login page, then resumes OAuth

## How Data is Used in Klaviyo

Once connected, Ainomiq does NOT modify any Klaviyo data. We only READ:

- Account information
- Campaign and flow performance metrics
- Subscriber profile data
- Segment definitions

Our AI uses this data to:

1. Display performance dashboards in the Ainomiq app
2. Generate automated customer support responses (stored as Klaviyo events)
3. Provide optimization recommendations

## Data Deletion

If a user disconnects Klaviyo or deletes their Ainomiq account:

1. OAuth token is revoked
2. All cached Klaviyo data is deleted within 24 hours
3. Data deletion webhook endpoint: https://app.ainomiq.com/api/data-deletion

## Technical Details

- **OAuth implementation:** PKCE (Proof Key for Code Exchange) with S256
- **Token storage:** Encrypted in PostgreSQL, never exposed to client
- **Token refresh:** Automatic refresh before expiry
- **API version:** Klaviyo API v2024-02-15
- **Webhook support:** Not currently used (read-only integration)

## Contact

For any questions during review:

- **Email:** support@ainomiq.com
- **Developer:** Ainomiq B.V.
