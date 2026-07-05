/**
 * Client-safe Meta (Instagram/Facebook) OAuth URL helpers.
 */

export type MetaConnectIntent = 'content' | 'messaging' | 'posting' | 'ads';
export type MetaConnectPlatform = 'instagram' | 'facebook' | 'both';

export const META_RETURN_PATHS = {
  contentStudio: '/dashboard/content-pipeline?menu=agent&connected=meta',
  contentSetup: '/dashboard/automations/content-pipeline',
  intelliSupport: '/dashboard/cs?connected=meta',
  csOnboarding: '/dashboard/automations/cs-onboarding?connected=meta',
  settings: '/dashboard/settings?tab=integrations',
} as const;

export const META_CONNECT_SUCCESS_AUTOMATION: Record<
  Exclude<MetaConnectIntent, 'ads'>,
  string
> = {
  content: 'content-pipeline',
  messaging: 'ai-customer-service',
  posting: 'content-pipeline',
};

export function buildMetaConnectQuery(args: {
  tenantId: string;
  intent?: MetaConnectIntent;
  platform?: MetaConnectPlatform;
  returnTo?: string;
  force?: boolean;
}): string {
  const params = new URLSearchParams({ tenant_id: args.tenantId });
  const intent = args.intent || 'content';
  if (intent !== 'ads') {
    params.set('intent', intent);
  }
  if (args.platform) params.set('platform', args.platform);
  if (args.force) params.set('force', '1');
  if (args.returnTo?.trim()) params.set('return_to', args.returnTo.trim());
  return params.toString();
}

export function buildMetaConnectHref(args: {
  tenantId: string;
  intent?: MetaConnectIntent;
  platform?: MetaConnectPlatform;
  returnTo?: string;
  force?: boolean;
}): string {
  return `/api/auth/meta/connect?${buildMetaConnectQuery(args)}`;
}

export function buildInstagramConnectHref(args: {
  tenantId: string;
  intent?: MetaConnectIntent;
  returnTo?: string;
  force?: boolean;
}): string {
  const params = new URLSearchParams({ tenant_id: args.tenantId });
  const intent = args.intent || 'content';
  if (intent !== 'ads') params.set('intent', intent);
  if (args.force) params.set('force', '1');
  if (args.returnTo?.trim()) params.set('return_to', args.returnTo.trim());
  return `/api/auth/instagram/connect?${params.toString()}`;
}

export function safeMetaDashboardReturn(path: string | null | undefined, fallback: string): string {
  if (path?.trim().startsWith('/dashboard/')) return path.trim();
  return fallback;
}

export function isMetaSettingsReturn(path: string): boolean {
  return path.startsWith('/dashboard/settings');
}

export const META_SETTINGS_CONNECTED_PARAM: Record<
  Exclude<MetaConnectIntent, 'ads'>,
  string
> = {
  messaging: 'meta_messaging',
  posting: 'meta_posting',
  content: 'meta_content',
};

export function metaSettingsOAuthReturn(path: string, connected: string): string {
  const url = new URL(path, 'https://app.ainomiq.com');
  url.searchParams.set('connected', connected);
  return `${url.pathname}${url.search}`;
}

export function metaContentErrorRedirect(
  intent: MetaConnectIntent,
  error: string,
  returnPath?: string,
): string {
  if (returnPath && isMetaSettingsReturn(returnPath)) {
    const url = new URL(returnPath, 'https://app.ainomiq.com');
    url.searchParams.set('error', error);
    return `${url.pathname}${url.search}`;
  }
  if (intent === 'messaging') {
    return `/dashboard/cs?error=${encodeURIComponent(error)}`;
  }
  return `/dashboard/automations/content-pipeline?error=${error}`;
}

export function metaConnectSuccessPath(args: {
  intent: MetaConnectIntent;
  provider: string;
  returnTo: string;
}): string {
  const automation =
    args.intent === 'ads'
      ? 'content-pipeline'
      : META_CONNECT_SUCCESS_AUTOMATION[args.intent] || 'content-pipeline';
  const returnTo = encodeURIComponent(args.returnTo);
  const provider = encodeURIComponent(args.provider);
  return `/dashboard/automations/connect-success?automation=${automation}&provider=${provider}&returnTo=${returnTo}`;
}
