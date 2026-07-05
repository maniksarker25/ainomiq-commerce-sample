/** Placeholder tenant_id in oauth_states for App Store install (no Ainomiq session yet). */
export const SHOPIFY_INSTALL_PENDING_TENANT = '__shopify_install_pending__'

export const SHOPIFY_INSTALL_RETURN_PREFIX = 'shopify_install:'

export function isShopifyInstallReturnTo(returnTo: string | undefined): returnTo is string {
  return Boolean(returnTo?.startsWith(SHOPIFY_INSTALL_RETURN_PREFIX))
}

export function shopFromInstallReturnTo(returnTo: string): string {
  return returnTo.slice(SHOPIFY_INSTALL_RETURN_PREFIX.length)
}
