import type { NextRequest } from 'next/server'

const DEFAULT_APP_BASE_URL = 'https://app.ainomiq.com'

export function resolveAppBaseUrl(request: NextRequest): string {
  const configured = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (configured) return configured.replace(/\/$/, '')

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  if (!host) return DEFAULT_APP_BASE_URL

  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  const forwardedProto = request.headers.get('x-forwarded-proto')?.trim()
  const fallbackProto = request.nextUrl.protocol?.replace(':', '') || 'https'
  const proto = isLocalhost ? 'http' : (forwardedProto || fallbackProto)

  return `${proto}://${host}`
}

export function settingsRedirectUrl(
  request: NextRequest,
  params: Record<string, string | null | undefined>,
): string {
  const url = new URL('/dashboard/settings', resolveAppBaseUrl(request))

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  return url.toString()
}

export function callbackRedirectUrl(request: NextRequest): string {
  return `${resolveAppBaseUrl(request)}${request.nextUrl.pathname}`
}
