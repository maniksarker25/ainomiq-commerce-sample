/**
 * Verifies Shopify's HMAC on the initial OAuth / install query string.
 * Uses Web Crypto to remain fully compatible with Edge Runtimes (like Next.js middleware).
 * @see https://shopify.dev/docs/apps/auth/oauth/getting-started#step-1-verify-the-installation-request
 */
export async function verifyShopifyInstallHmac(searchParams: URLSearchParams): Promise<boolean> {
  const secret = (process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '').trim()
  const hmac = searchParams.get('hmac')
  if (!secret || !hmac) return false

  const pairs: [string, string][] = []
  searchParams.forEach((value, key) => {
    if (key === 'hmac' || key === 'signature') return
    pairs.push([key, value])
  })
  pairs.sort((a, b) => a[0].localeCompare(b[0]))
  const message = pairs.map(([k, v]) => `${k}=${v}`).join('&')

  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(message)

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await globalThis.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    )

    const signatureArray = Array.from(new Uint8Array(signatureBuffer))
    const digest = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Safe constant-time comparison
    if (digest.length !== hmac.length) return false
    let equal = true
    for (let i = 0; i < digest.length; i++) {
      if (digest[i] !== hmac[i]) {
        equal = false
      }
    }
    return equal
  } catch (err) {
    console.error('verifyShopifyInstallHmac Web Crypto error:', err)
    return false
  }
}

export function isLikelyShopifyInstallQuery(searchParams: URLSearchParams): boolean {
  const shop = searchParams.get('shop')
  const hmac = searchParams.get('hmac')
  return Boolean(shop && hmac && /\.myshopify\.com$/i.test(shop))
}
