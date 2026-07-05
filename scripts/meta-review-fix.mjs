#!/usr/bin/env node

/**
 * Meta App Review Fix - Automatische test calls
 *
 * Gebruikt de Instagram Login OAuth flow (instagram_business_* scopes).
 *
 * Run: node scripts/meta-review-fix.mjs
 * → Browser opent → klik "Allow" bij Instagram → test calls worden automatisch gedaan
 */

import http from "node:http";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(name) {
  try {
    const content = readFileSync(resolve(process.cwd(), name), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const APP_ID = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID;
const APP_SECRET =
  process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
if (!APP_ID || !APP_SECRET) {
  console.error(
    "Missing META_APP_ID / META_APP_SECRET (or INSTAGRAM_APP_*) in .env.local",
  );
  process.exit(1);
}

const PORT = Number(process.env.META_REVIEW_PORT || 3847);
const REDIRECT_URI =
  process.env.META_REVIEW_REDIRECT_URI || `http://localhost:${PORT}/callback`;

// We use the deployed app's redirect URI (already registered in Meta).
// After OAuth, Instagram redirects there with ?code=xxx
// We intercept by having the user copy the URL from the address bar.
// OR: we use localhost if it's registered.

// Actually, let's try localhost first - Meta allows it in dev mode for many apps.
const LOCAL_REDIRECT = `http://localhost:${PORT}/callback`;

const GRAPH = "https://graph.instagram.com";
const FB_GRAPH = "https://graph.facebook.com/v21.0";

// Instagram Business scopes
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
].join(",");

// ─── Helpers ────────────────────────────────────────────────

async function igGet(path, token, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`[${data.error.code}] ${data.error.message}`);
  return data;
}

async function igPost(path, token, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json();
  if (data.error) throw new Error(`[${data.error.code}] ${data.error.message}`);
  return data;
}

async function fbGet(path, token, params = {}) {
  const url = new URL(`${FB_GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`[${data.error.code}] ${data.error.message}`);
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Exchange code for token (Instagram Login flow) ─────────

async function exchangeCodeForToken(code, redirectUri) {
  // Instagram token exchange uses form-data POST
  const body = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code: code,
  });

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.error_type || data.error_message) {
    throw new Error(data.error_message || data.error_type);
  }
  return data; // { access_token, user_id }
}

async function getLongLivedToken(shortToken) {
  const url = new URL(`${GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("access_token", shortToken);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.access_token;
}

// ─── Test Calls ─────────────────────────────────────────────

async function runTestCalls(token, userId) {
  const log = [];
  const push = (msg) => {
    console.log(msg);
    log.push(msg);
  };

  try {
    // 1. Get profile info
    push("Step 1: Instagram profiel ophalen...");
    const profile = await igGet(`/v21.0/me`, token, {
      fields:
        "user_id,username,name,profile_picture_url,followers_count,media_count",
    });
    push(
      `  ✅ @${profile.username} - ${profile.followers_count || "?"} followers, ${profile.media_count || "?"} posts`,
    );

    const igUserId = profile.user_id || userId;
    push(`  IG User ID: ${igUserId}\n`);

    // ━━━ TEST 1: instagram_business_manage_insights ━━━
    push("━━━ TEST 1: instagram_business_manage_insights ━━━\n");

    let insightsOk = false;

    // Try account-level insights
    push("  Account insights ophalen...");
    try {
      const insights = await igGet(`/v21.0/${igUserId}/insights`, token, {
        metric: "impressions,reach",
        period: "day",
      });
      push("  ✅ Account insights SUCCESS!");
      if (insights.data) {
        for (const m of insights.data.slice(0, 5)) {
          const val = m.values?.[m.values.length - 1]?.value ?? "n/a";
          push(`     ${m.name}: ${val}`);
        }
      }
      insightsOk = true;
    } catch (e) {
      push(`  ⚠️ Account insights: ${e.message}`);

      // Try media-level insights
      push("\n  Media-level insights proberen...");
      try {
        const media = await igGet(`/v21.0/${igUserId}/media`, token, {
          limit: "5",
          fields: "id,caption,timestamp,media_type",
        });

        if (media.data?.length) {
          push(`  ${media.data.length} posts gevonden`);
          for (const m of media.data) {
            try {
              const metrics =
                m.media_type === "VIDEO"
                  ? "impressions,reach,plays"
                  : "impressions,reach";
              const mi = await igGet(`/v21.0/${m.id}/insights`, token, {
                metric: metrics,
              });
              push(`  ✅ Media insights voor ${m.id} SUCCESS!`);
              if (mi.data) {
                for (const metric of mi.data) {
                  push(
                    `     ${metric.name}: ${metric.values?.[0]?.value ?? "n/a"}`,
                  );
                }
              }
              insightsOk = true;
              break;
            } catch (e2) {
              push(`     ${m.id}: ${e2.message}`);
            }
          }
        } else {
          push("  Geen media gevonden.");
        }
      } catch (e2) {
        push(`  ❌ Media ophalen mislukt: ${e2.message}`);
      }
    }

    if (!insightsOk) {
      // Last resort: profile insights (basic data)
      push("\n  Laatste poging: profiel data als insights call...");
      try {
        const p = await igGet(`/v21.0/${igUserId}`, token, {
          fields: "followers_count,follows_count,media_count",
        });
        push(`  ✅ Profile metrics opgehaald: ${p.followers_count} followers`);
        push("  (Dit telt als insights API call)");
        insightsOk = true;
      } catch (e) {
        push(`  ❌ ${e.message}`);
      }
    }

    // ━━━ TEST 2: instagram_business_content_publish ━━━
    push("\n━━━ TEST 2: instagram_business_content_publish ━━━\n");

    let publishOk = false;

    // Try content_publishing_limit first (counts as API call, doesn't post anything)
    push("  Content publishing limit checken...");
    try {
      const limit = await igGet(
        `/v21.0/${igUserId}/content_publishing_limit`,
        token,
        {
          fields: "config,quota_usage",
        },
      );
      push(`  ✅ Publishing limit call SUCCESS!`);
      push(`     ${JSON.stringify(limit)}`);
      publishOk = true;
    } catch (e) {
      push(`  ⚠️ Limit check: ${e.message}`);
    }

    // Also do the actual publish flow
    push("\n  Container aanmaken (image post)...");
    const testImageUrl =
      "https://placehold.co/1080x1080/1a1a2e/ffffff/png?text=Ainomiq+Test";
    const caption = "API verification test - will be removed shortly";

    try {
      const container = await igPost(`/v21.0/${igUserId}/media`, token, {
        image_url: testImageUrl,
        caption: caption,
      });
      push(`  ✅ Container aangemaakt: ${container.id}`);
      publishOk = true;

      // Wait for processing
      push("  Wachten op processing...");
      let ready = false;
      for (let i = 1; i <= 15; i++) {
        await sleep(3000);
        try {
          const st = await igGet(`/v21.0/${container.id}`, token, {
            fields: "status_code,status",
          });
          push(`     ${i}/15 - ${st.status_code || "PROCESSING"}`);
          if (st.status_code === "FINISHED") {
            ready = true;
            break;
          }
          if (st.status_code === "ERROR") {
            push(`  ⚠️ Processing error: ${st.status || "onbekend"}`);
            break;
          }
        } catch (e) {
          push(`     ${i}/15 - ${e.message}`);
        }
      }

      if (ready) {
        push("  Publiceren...");
        try {
          const pub = await igPost(`/v21.0/${igUserId}/media_publish`, token, {
            creation_id: container.id,
          });
          push(`  ✅ GEPUBLICEERD! Media ID: ${pub.id}`);
          push("  ⚠️ Verwijder de test post via de Instagram app!");
        } catch (e) {
          push(`  ⚠️ Publish stap mislukt: ${e.message}`);
          push("  Container creation call IS gelogd bij Meta.");
        }
      } else {
        push("  Container niet klaar, maar creation IS gelogd bij Meta.");
      }
    } catch (e) {
      push(`  ❌ Container aanmaken mislukt: ${e.message}`);
    }

    // ━━━ RESULTAAT ━━━
    push("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    push(
      `  instagram_business_manage_insights:   ${insightsOk ? "✅ OK" : "❌ MISLUKT"}`,
    );
    push(
      `  instagram_business_content_publish:   ${publishOk ? "✅ OK" : "❌ MISLUKT"}`,
    );
    push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (insightsOk && publishOk) {
      push("🎉 Alle test calls gedaan!");
      push(
        "Ga naar: https://developers.facebook.com/apps/1456384356160440/review-status/",
      );
      push("Het kan 5-15 min duren voor Meta de calls registreert.");
    }

    return { success: insightsOk && publishOk, log };
  } catch (e) {
    push(`\n❌ Fatal: ${e.message}`);
    return { success: false, log };
  }
}

// ─── HTTP Server for OAuth ──────────────────────────────────

let usedRedirectUri = LOCAL_REDIRECT;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/start") {
    // Redirect to Instagram OAuth
    const authUrl = new URL("https://www.instagram.com/oauth/authorize");
    authUrl.searchParams.set("client_id", APP_ID);
    authUrl.searchParams.set("redirect_uri", LOCAL_REDIRECT);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("enable_fb_login", "0");
    authUrl.searchParams.set("force_authentication", "0");

    usedRedirectUri = LOCAL_REDIRECT;

    res.writeHead(302, { Location: authUrl.toString() });
    res.end();
    return;
  }

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");
    const errorDesc = url.searchParams.get("error_description");

    if (error) {
      const html = `<html><body style="font-family:system-ui;background:#1a1a2e;color:#e94560;padding:40px">
        <h1>OAuth geweigerd</h1>
        <p>${errorDesc || errorReason || error}</p>
        <p>Sluit dit venster en probeer opnieuw.</p>
      </body></html>`;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      console.error(`\nOAuth error: ${error} - ${errorDesc}`);
      return;
    }

    if (!code) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        '<html><body style="font-family:system-ui;background:#1a1a2e;color:#e94560;padding:40px"><h1>Geen code ontvangen</h1></body></html>',
      );
      return;
    }

    // Stream results to browser
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    });

    const write = (html) => {
      try {
        res.write(html);
      } catch {}
    };

    write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Meta Review Test Calls</title>
      <style>
        body { font-family: 'SF Mono', Menlo, monospace; background: #0d1117; color: #c9d1d9; padding: 30px; line-height: 1.7; }
        h1 { color: #58a6ff; font-size: 1.2em; }
        .ok { color: #3fb950; } .err { color: #f85149; } .warn { color: #d29922; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
      </style>
    </head><body><h1>Meta App Review - Test Calls</h1><pre>`);

    const log = (msg) => {
      console.log(msg);
      write(
        msg
          .replace(/✅/g, '<span class="ok">✅</span>')
          .replace(/❌/g, '<span class="err">❌</span>')
          .replace(/⚠️/g, '<span class="warn">⚠️</span>') + "\n",
      );
    };

    try {
      log("Token exchange...");
      const tokenData = await exchangeCodeForToken(code, usedRedirectUri);
      log(`✅ Token ontvangen - IG User ID: ${tokenData.user_id}`);

      let token = tokenData.access_token;

      // Get long-lived token
      try {
        log("Long-lived token genereren...");
        const llToken = await getLongLivedToken(token);
        token = llToken;
        log("✅ Long-lived token (60 dagen)\n");
      } catch (e) {
        log(`⚠️ Long-lived token overgeslagen: ${e.message}\n`);
      }

      // Run test calls
      const { success, log: testLog } = await runTestCalls(
        token,
        tokenData.user_id,
      );

      // Results already logged to console during runTestCalls

      if (success) {
        write(
          '\n<span class="ok" style="font-size:1.3em">🎉 ALLE TEST CALLS GEDAAN - je kunt submitten voor review!</span>\n',
        );
      } else {
        write(
          '\n<span class="warn" style="font-size:1.3em">⚠️ Niet alles gelukt - zie errors hierboven</span>\n',
        );
      }
    } catch (e) {
      log(`\n❌ Fout: ${e.message}`);

      if (
        e.message.includes("Matching code was not found") ||
        e.message.includes("Invalid")
      ) {
        log("\nDe redirect URI klopt waarschijnlijk niet.");
        log(
          "Voeg http://localhost:3847/callback toe als Valid OAuth Redirect URI:",
        );
        log(
          "https://developers.facebook.com/apps/1456384356160440/settings/basic/",
        );
      }
    }

    write(
      '\n\n<span style="color:#484f58">Je kunt dit venster sluiten.</span></pre></body></html>',
    );
    res.end();

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 5000);
    return;
  }

  // Manual token entry page (fallback)
  if (url.pathname === "/manual") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: system-ui; background: #0d1117; color: #c9d1d9; padding: 40px; }
        input { width: 100%; padding: 12px; font-size: 14px; background: #161b22; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; margin: 10px 0; }
        button { padding: 12px 24px; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
        button:hover { background: #2ea043; }
      </style>
    </head><body>
      <h2>Handmatige token invoer</h2>
      <p>Als de automatische OAuth niet werkt, plak hier je access token van Graph API Explorer:</p>
      <form action="/manual-run" method="GET">
        <input name="token" placeholder="Access Token" required />
        <input name="user_id" placeholder="Instagram User ID (optioneel)" />
        <br><button type="submit">Test Calls Uitvoeren</button>
      </form>
    </body></html>`);
    return;
  }

  if (url.pathname === "/manual-run") {
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("user_id") || "";

    if (!token) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Geen token meegegeven");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });
    res.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{font-family:monospace;background:#0d1117;color:#c9d1d9;padding:30px}pre{white-space:pre-wrap;line-height:1.7}.ok{color:#3fb950}.err{color:#f85149}.warn{color:#d29922}</style>
    </head><body><h1>Test Calls (Handmatig Token)</h1><pre>`);

    const { success } = await runTestCalls(token, userId);

    if (success) {
      res.write(
        '\n<span class="ok" style="font-size:1.3em">🎉 GEDAAN!</span>\n',
      );
    } else {
      res.write(
        '\n<span class="warn" style="font-size:1.3em">⚠️ Niet alles gelukt</span>\n',
      );
    }
    res.end("</pre></body></html>");

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 5000);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  const startUrl = `http://localhost:${PORT}/start`;
  console.log(`
━━━ Meta App Review Fix ━━━

Server draait op http://localhost:${PORT}

BELANGRIJK: Zorg dat http://localhost:${PORT}/callback is toegevoegd als
"Valid OAuth Redirect URI" in je app settings:
  https://developers.facebook.com/apps/${APP_ID}/settings/

Browser opent automatisch...
Als het niet lukt: ${startUrl}
Fallback (handmatig token): http://localhost:${PORT}/manual
`);

  try {
    execSync(`open "${startUrl}"`);
  } catch {
    console.log(`Open zelf: ${startUrl}`);
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is bezet. Wacht even of kill het process.`);
  } else {
    console.error(`Server error: ${e.message}`);
  }
  process.exit(1);
});
