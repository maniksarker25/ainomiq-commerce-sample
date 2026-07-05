# Performance Page Mega Upgrade - Better Than Triple Whale

## Goal

Transform the Performance page from a basic ad stats viewer into a full e-commerce profit command center.
Must work with LIVE data from connected platforms. No hardcoded values. No cache files.

## Reference: Triple Whale Summary Page Metrics

Triple Whale's key metrics:

- Net Profit = Total Sales - Blended Ad Spend - Total Costs (COGS, Shipping, Handling, Payment Gateways, Taxes)
- Blended ROAS = Total Revenue / Total Ad Spend
- Customer Acquisition Cost (CAC) = Total Ad Spend / New Customers
- Average Order Value (AOV)
- Conversion Rate
- Customer Lifetime Value (LTV)
- Return Rate
- Gross Margin

We do ALL of this, plus we add AI agent insights on top.

## Architecture

### Data Sources (all via existing lib/)

1. **Meta Ads** (`lib/meta.ts`) - Already connected. Ad spend, ROAS, CPC, CTR, CPM, purchases, impressions, clicks, revenue
2. **Shopify** (`lib/shopify.ts`) - Already has token+fetch. Need: orders, revenue, COGS, shipping costs, payment gateway fees, refunds, customers (new vs returning), products
3. **Google Ads** - Coming Soon (keep placeholder)
4. **TikTok Ads** - Coming Soon (keep placeholder)
5. **Snapchat Ads** - Coming Soon (keep placeholder)

### Bug Fix: Data Must Auto-Sync After Connection

Currently when Meta is connected, the Performance page shows "No platforms connected" until refresh.
**Fix**: After Meta OAuth callback redirects back, the page must detect the connection and immediately fetch data.
The issue is likely that `fetchPlatformStatus` runs on mount but the platform state doesn't update reactively.

## New API Routes Needed

### `/api/shopify/stats` (NEW)

Fetches from Shopify for the given timeframe:

- Total revenue (orders sum)
- Total orders count
- Average Order Value (revenue / orders)
- New customers count
- Returning customers count
- Total refunds amount
- Refund rate (refunds / orders)
- COGS (from product cost fields if available, or from order line items `cost` property)
- Shipping costs collected
- Payment gateway name + fees (from transactions)

Uses `getShopifyTokenAndFetch()` from `lib/shopify.ts`.

Shopify API endpoints:

- `GET /admin/api/2024-01/orders.json?status=any&created_at_min={start}&created_at_max={end}&fields=id,total_price,subtotal_price,total_shipping_price_set,financial_status,customer,line_items,refunds,created_at`
- For COGS: line_items have `price` but not always `cost`. Alternative: use product `cost_per_item` from inventory items
- For payment gateway fees: `GET /admin/api/2024-01/orders/{id}/transactions.json` - fees in the transaction object
- For customers: check `customer.orders_count` - if 1, they're new

### `/api/performance/summary` (NEW)

Aggregates ALL connected platform data into a single response:

```json
{
  "timeframe": "7d",
  "revenue": { "total": 5240.5, "change": 12.3 },
  "adSpend": { "total": 1820.0, "change": -5.2 },
  "netProfit": { "total": 1890.3, "change": 8.1 },
  "blendedROAS": { "value": 2.88, "change": 0.3 },
  "orders": { "total": 176, "change": 15 },
  "aov": { "value": 29.78, "change": -1.2 },
  "newCustomers": { "total": 142, "change": 10 },
  "returningCustomers": { "total": 34, "change": 5 },
  "cac": { "value": 12.82, "change": -2.1 },
  "conversionRate": { "value": 3.2, "change": 0.4 },
  "refunds": { "total": 89.9, "rate": 1.7 },
  "cogs": { "total": 890.0 },
  "shipping": { "total": 1190.0 },
  "gatewayFees": { "total": 161.4 },
  "grossMargin": { "value": 68.2 },
  "platforms": {
    "meta": {
      "connected": true,
      "spend": 1820,
      "roas": 2.88,
      "purchases": 176,
      "cpc": 0.42,
      "ctr": 2.1,
      "cpm": 8.5,
      "impressions": 214000,
      "clicks": 4320
    },
    "shopify": { "connected": true },
    "google": { "connected": false, "comingSoon": true },
    "tiktok": { "connected": false, "comingSoon": true },
    "snapchat": { "connected": false, "comingSoon": true }
  }
}
```

The `change` fields = percentage change vs previous period (e.g., 7d vs previous 7d).

## New UI Components

### 1. KPI Cards Row (Top)

A horizontal row of key metric cards, like Triple Whale's top bar:

- **Revenue** (from Shopify) - big number + % change + sparkline
- **Ad Spend** (from ad platforms) - big number + % change
- **Net Profit** (Revenue - Ad Spend - COGS - Shipping - Gateway Fees) - big number, GREEN if positive, RED if negative
- **Blended ROAS** (Revenue / Ad Spend) - big number + % change
- **Orders** (from Shopify) - count + % change
- **AOV** (Revenue / Orders) - big number
- **New Customers** - count + % change
- **CAC** (Ad Spend / New Customers) - big number

Each card: glassmorphism style, subtle border, monochrome with colored accents for positive (green) / negative (red) changes.

### 2. Revenue vs Spend Chart

A line/area chart showing Revenue and Ad Spend over time (day by day).
Use a simple SVG-based chart or lightweight charting library (recharts is fine, it's already in Next.js ecosystem).

- Revenue line in blue
- Ad Spend line in red/orange
- Net Profit area fill between them

### 3. Profit Breakdown Card

Visual breakdown showing:

```
Revenue:          EUR 5,240.50  (100%)
- COGS:           EUR   890.00  (17%)
- Shipping:       EUR 1,190.00  (23%)
- Gateway Fees:   EUR   161.40  (3%)
- Ad Spend:       EUR 1,820.00  (35%)
= Net Profit:     EUR 1,179.10  (22%)
```

With a horizontal stacked bar visualization.

### 4. Platform Connection Cards (keep existing, improve)

Keep the 4 platform cards (Meta, Google, TikTok, Snapchat) but ADD a **Shopify** card at the start.
Shopify card shows: Revenue, Orders, AOV when connected.

### 5. Per-Platform Ad Breakdown (improve existing)

For connected ad platforms, show a table with:

- Campaign name
- Spend
- Revenue (from purchase_value)
- ROAS
- CPC
- CTR
- CPM
- Purchases
- CPA (spend / purchases)

Scrollable table (maxHeight 480px).

### 6. Customer Insights Card

- New vs Returning customers (donut chart or simple split bar)
- CAC trend
- Repeat purchase rate

## Shopify Connection Flow

The Shopify "Connect" button on the Performance page should use the existing `/api/auth/shopify/connect` route.
After connecting, the page auto-refreshes data.

Shopify OAuth scopes needed: `read_orders,read_products,read_customers,read_inventory`
(Already in the TOML: `read_orders,read_products,read_customers`)

## Design Requirements

- Monochrome base (black/white/gray) with colored accents only for data (green = good, red = bad)
- Glassmorphism cards (existing `glass` CSS class)
- EUR currency format everywhere (Dutch locale: `EUR 1.234,56`)
- No emojis
- Responsive (mobile-friendly)
- Scrollable tables (maxHeight 480px)
- Loading skeletons while data loads
- Time period selector: Today, 7d, 14d, 30d, 90d (existing, keep)

## Technical Notes

- All data is LIVE - API calls on every page load
- Use in-memory caching (5 min TTL max) for expensive Shopify queries
- The `lib/shopify.ts` already has `getShopifyTokenAndFetch()` - use it
- The `lib/meta.ts` already has `getMetaTokenAndFetch()` - use it
- Shopify API rate limit: 40 requests/minute for REST - batch requests intelligently
- For period comparison (% change), make 2 API calls: current period + previous period
- Install `recharts` for charts: `npm install recharts`

## Files to Create/Modify

- `app/api/shopify/stats/route.ts` - NEW
- `app/api/performance/summary/route.ts` - NEW
- `app/dashboard/performance/page.tsx` - REWRITE
- `components/KPICard.tsx` - NEW
- `components/ProfitBreakdown.tsx` - NEW
- `components/RevenueChart.tsx` - NEW
- `components/CustomerInsights.tsx` - NEW

## Priority Order

1. Fix auto-sync bug (data shows immediately after connecting)
2. Shopify stats API route
3. Performance summary API route
4. KPI cards row
5. Profit breakdown
6. Revenue chart
7. Customer insights
8. Per-platform ad breakdown table

## What NOT to Do

- Do NOT hardcode any values
- Do NOT use cached files
- Do NOT break existing Meta connection flow
- Do NOT remove Coming Soon placeholders for Google/TikTok/Snapchat
- Do NOT add emojis
- Do NOT use markdown tables in the UI
