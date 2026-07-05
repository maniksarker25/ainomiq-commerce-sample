const APP_BASE_URL = process.env.APP_BASE_URL?.trim() || 'https://app.ainomiq.com'

function normalizeOAuthTarget(target: string) {
  try {
    const url = new URL(target, APP_BASE_URL)
    return url.toString()
  } catch {
    return `${APP_BASE_URL}/dashboard/settings?error=redirect_failed`
  }
}

export function oauthRedirect(target: string) {
  const url = normalizeOAuthTarget(target)
  const escaped = JSON.stringify(url)

  return new Response(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0;url=${url.replace(/"/g, '&quot;')}">
  <script>window.location.replace(${escaped});</script>
</head>
<body style="margin:0;background:#f5f7fb;color:#334155;font-family:Inter,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
  <p>Finishing connection...</p>
</body>
</html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
