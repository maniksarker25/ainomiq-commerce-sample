export type AppIntegrationId = 'meta' | 'instagram' | 'facebook' | 'asset_library' | 'shopify' | 'klaviyo' | 'gmail' | 'twilio' | 'custom_api';

export type AppSettings = {
  app_id: string;
  dir: string;
  integrations: AppIntegrationId[];
  notes?: string;
  updated_at?: string;
};

export type AppDefinition = {
  id: string;
  title: string;
  dir: string;
  defaultIntegrations: AppIntegrationId[];
  integrationOptions: AppIntegrationId[];
};

export const INTEGRATION_LABELS: Record<AppIntegrationId, string> = {
  meta: 'Meta',
  instagram: 'Instagram',
  facebook: 'Facebook',
  asset_library: 'Ainomiq Library',
  shopify: 'Shopify',
  klaviyo: 'Klaviyo',
  gmail: 'Gmail',
  twilio: 'Twilio',
  custom_api: 'Custom API',
};

export const APP_DEFINITIONS: AppDefinition[] = [
  {
    id: 'ai-ad-manager',
    title: 'Logic Ads',
    dir: '/dashboard/meta-setup',
    defaultIntegrations: ['meta', 'facebook', 'instagram'],
    integrationOptions: ['meta', 'facebook', 'instagram', 'shopify', 'custom_api'],
  },
  {
    id: 'ai-customer-service',
    title: 'AI Customer Service',
    dir: '/dashboard/automations/cs-onboarding',
    defaultIntegrations: ['gmail', 'instagram', 'facebook', 'shopify'],
    integrationOptions: ['gmail', 'instagram', 'facebook', 'shopify', 'twilio', 'custom_api'],
  },
  {
    id: 'smart-inventory',
    title: 'Smart Inventory',
    dir: '/dashboard/stock',
    defaultIntegrations: ['shopify'],
    integrationOptions: ['shopify', 'asset_library', 'custom_api'],
  },
  {
    id: 'email-automation',
    title: 'Email Automation',
    dir: '/dashboard/email',
    defaultIntegrations: ['klaviyo'],
    integrationOptions: ['klaviyo', 'shopify', 'asset_library', 'custom_api'],
  },
  {
    id: 'content-pipeline',
    title: 'Content Studio',
    dir: '/dashboard/content-pipeline',
    defaultIntegrations: ['instagram', 'facebook', 'asset_library'],
    integrationOptions: ['instagram', 'facebook', 'meta', 'asset_library', 'shopify', 'custom_api'],
  },
  {
    id: 'review-management',
    title: 'Review Management',
    dir: '/dashboard/reviews',
    defaultIntegrations: ['shopify'],
    integrationOptions: ['shopify', 'klaviyo', 'custom_api'],
  },
  {
    id: 'affiliate-creator-program',
    title: 'Affiliate & Creator Program',
    dir: '/dashboard/creators',
    defaultIntegrations: ['shopify', 'instagram'],
    integrationOptions: ['shopify', 'instagram', 'facebook', 'asset_library', 'custom_api'],
  },
  {
    id: 'pricing-optimization',
    title: 'Dynamic Pricing',
    dir: '/dashboard/pricing',
    defaultIntegrations: ['shopify'],
    integrationOptions: ['shopify', 'custom_api'],
  },
];

export function getAppDefinition(appId: string) {
  return APP_DEFINITIONS.find(app => app.id === appId) || null;
}

export function getDefaultAppSettings(appId: string): AppSettings {
  const app = getAppDefinition(appId);
  return {
    app_id: appId,
    dir: app?.dir || `/dashboard/${appId}`,
    integrations: app?.defaultIntegrations || [],
    notes: '',
  };
}

export function sanitizeAppSettings(appId: string, input: any, existing?: AppSettings | null): AppSettings {
  const fallback = existing || getDefaultAppSettings(appId);
  const app = getAppDefinition(appId);
  const allowed = new Set<AppIntegrationId>(app?.integrationOptions || Object.keys(INTEGRATION_LABELS) as AppIntegrationId[]);
  const integrations = Array.isArray(input?.integrations)
    ? input.integrations.map(String).filter((value: string): value is AppIntegrationId => allowed.has(value as AppIntegrationId)).slice(0, 12)
    : fallback.integrations;

  return {
    app_id: appId,
    dir: String(input?.dir || fallback.dir || app?.dir || '').trim().slice(0, 300),
    integrations,
    notes: String(input?.notes || fallback.notes || '').trim().slice(0, 1200),
    updated_at: new Date().toISOString(),
  };
}
