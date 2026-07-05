// OAuth configuration for each provider

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  redirectUri: string
  // Provider-specific parameters
  extraAuthParams?: Record<string, string>
}

export const getEnv = (key: string): string => {
  const value = process.env[key]?.trim()
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}

const readEnv = (key: string): string => process.env[key]?.trim() || ''

/** Must match [access_scopes].scopes in shopify.app.toml and Partner Dashboard. */
export const SHOPIFY_ACCESS_SCOPES_STRING =
  'read_analytics,read_customers,write_customers,read_price_rules,write_price_rules,read_discounts,write_discounts,write_draft_orders,read_draft_orders,read_fulfillments,write_fulfillments,read_gift_cards,write_gift_cards,write_inventory,read_inventory,read_locales,read_locations,read_markets,read_orders,write_orders,read_products,write_products,read_reports,read_returns,read_shipping,read_content,read_themes'

const shopifyShopDomain = readEnv('SHOPIFY_SHOP_DOMAIN')
export const shopifyConfig: OAuthConfig = {
  clientId: readEnv('SHOPIFY_CLIENT_ID'),
  clientSecret: readEnv('SHOPIFY_CLIENT_SECRET'),
  authUrl: shopifyShopDomain ? `https://${shopifyShopDomain}/admin/oauth/authorize` : '',
  tokenUrl: shopifyShopDomain ? `https://${shopifyShopDomain}/admin/oauth/access_token` : '',
  scopes: SHOPIFY_ACCESS_SCOPES_STRING.split(',').map((s) => s.trim()).filter(Boolean),
  redirectUri: readEnv('SHOPIFY_REDIRECT_URI'),
  extraAuthParams: {
    // Shopify OAuth2 doesn't require extra parameters
  },
}

export const metaConfig: OAuthConfig = {
  clientId: readEnv('META_APP_ID'),
  clientSecret: readEnv('META_APP_SECRET'),
  authUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
  scopes: ['ads_read', 'ads_management', 'read_insights', 'pages_read_engagement'],
  redirectUri: readEnv('META_REDIRECT_URI'),
}

const APP_BASE_URL = process.env.APP_BASE_URL?.trim() || 'https://app.ainomiq.com'

export const instagramConfig: OAuthConfig = {
  clientId: readEnv('META_APP_ID'),
  clientSecret: readEnv('META_APP_SECRET'),
  authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
  scopes: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments', 'pages_show_list', 'pages_manage_metadata'],
  redirectUri: `${APP_BASE_URL}/api/auth/callback/instagram`,
}

export const facebookConfig: OAuthConfig = {
  clientId: readEnv('META_APP_ID'),
  clientSecret: readEnv('META_APP_SECRET'),
  authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
  scopes: ['pages_messaging', 'pages_show_list', 'pages_manage_metadata', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement'],
  redirectUri: `${APP_BASE_URL}/api/auth/facebook/callback`,
}

export const klaviyoConfig: OAuthConfig = {
  clientId: readEnv('KLAVIYO_CLIENT_ID'),
  clientSecret: readEnv('KLAVIYO_CLIENT_SECRET'),
  authUrl: 'https://www.klaviyo.com/oauth/authorize',
  tokenUrl: 'https://a.klaviyo.com/oauth/token',
  scopes: ['accounts:read', 'campaigns:read', 'flows:read', 'metrics:read', 'profiles:read', 'profiles:write', 'segments:read', 'lists:read', 'lists:write', 'events:write'],
  redirectUri: readEnv('KLAVIYO_REDIRECT_URI'),
}

export const googleConfig: OAuthConfig = {
  clientId: readEnv('GOOGLE_CLIENT_ID'),
  clientSecret: readEnv('GOOGLE_CLIENT_SECRET'),
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
  redirectUri: readEnv('GOOGLE_REDIRECT_URI'),
  extraAuthParams: {
    access_type: 'offline',
    prompt: 'consent', // Ensure refresh token
  },
}