#!/usr/bin/env node

/**
 * Meta App Review - Vereiste Test API Calls
 *
 * Dit script maakt de test calls die Meta vereist voor:
 *   - instagram_content_publish
 *   - instagram_manage_insights
 *
 * STAPPEN:
 *   1. Ga naar https://developers.facebook.com/tools/explorer/
 *   2. Selecteer je app "Ainomiq" (NIET "Graph API Explorer")
 *   3. Klik "Generate Access Token" → kies "Get User Access Token"
 *   4. Vink aan:
 *        ✅ pages_show_list
 *        ✅ pages_read_engagement
 *        ✅ instagram_basic
 *        ✅ instagram_content_publish
 *        ✅ instagram_manage_insights
 *   5. Klik "Generate Access Token" en autoriseer
 *   6. Kopieer het token
 *   7. Run: node scripts/meta-test-calls.mjs JOUW_ACCESS_TOKEN
 *
 * LET OP: Dit publiceert een echte post op Instagram!
 *         Je kunt hem daarna handmatig verwijderen via de IG app.
 */

const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error(`
┌──────────────────────────────────────────────────────────────┐
│  Meta App Review - Test API Calls                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Usage: node scripts/meta-test-calls.mjs JOUW_ACCESS_TOKEN   │
│                                                              │
│  Stappen om het token te krijgen:                            │
│  1. Ga naar developers.facebook.com/tools/explorer           │
│  2. Selecteer app: "Ainomiq" (dropdown linksboven)           │
│  3. Klik "Generate Access Token"                             │
│  4. Selecteer permissions:                                   │
│     - pages_show_list                                        │
│     - pages_read_engagement                                  │
│     - instagram_basic                                        │
│     - instagram_content_publish                              │
│     - instagram_manage_insights                              │
│  5. Kopieer het gegenereerde token                           │
│  6. Run dit script opnieuw met het token                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘`);
  process.exit(1);
}

const API_VERSION = "v21.0";
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

// ─── Helpers ────────────────────────────────────────────────

async function graphCall(method, path, token, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { method });
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Non-JSON response (${res.status}): ${text.substring(0, 200)}`,
    );
  }

  if (data.error) {
    const e = data.error;
    throw new Error(
      `[${e.code}] ${e.message}${e.error_subcode ? ` (subcode: ${e.error_subcode})` : ""}`,
    );
  }
  return data;
}

const get = (path, token, params) => graphCall("GET", path, token, params);
const post = (path, token, params) => graphCall("POST", path, token, params);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log("\n━━━ Meta App Review - Test API Calls ━━━\n");

  // ── Step 1: Verify token & get user info ──
  console.log("Step 1: Token verifiëren...");
  const me = await get("/me", ACCESS_TOKEN, { fields: "id,name" });
  console.log(`  OK - Ingelogd als: ${me.name} (${me.id})\n`);

  // ── Step 2: Get Pages + Page Access Tokens ──
  console.log("Step 2: Facebook Pages ophalen...");
  const pages = await get("/me/accounts", ACCESS_TOKEN, {
    fields: "id,name,access_token,instagram_business_account",
  });

  if (!pages.data?.length) {
    console.error("  FOUT: Geen Facebook Pages gevonden.");
    console.error(
      "  Je hebt een Facebook Page nodig die gekoppeld is aan een IG Business account.",
    );
    process.exit(1);
  }

  console.log(`  Gevonden: ${pages.data.length} page(s)`);
  for (const p of pages.data) {
    const ig = p.instagram_business_account
      ? ` → IG: ${p.instagram_business_account.id}`
      : " → (geen IG)";
    console.log(`    - ${p.name} (${p.id})${ig}`);
  }

  // ── Step 3: Find page with IG Business Account ──
  const page = pages.data.find((p) => p.instagram_business_account);

  if (!page) {
    console.error(
      "\n  FOUT: Geen van je Pages heeft een Instagram Business Account gekoppeld.",
    );
    console.error(
      "  Ga naar je Facebook Page → Settings → Instagram → Connect Account",
    );
    console.error(
      "  Zorg dat je IG account een Business of Creator account is.",
    );
    process.exit(1);
  }

  const igId = page.instagram_business_account.id;
  const pageToken = page.access_token;
  console.log(
    `\n  Gebruik: Page "${page.name}" → IG Business Account: ${igId}\n`,
  );

  // ── Step 4: TEST instagram_manage_insights ──
  console.log("━━━ TEST 1: instagram_manage_insights ━━━\n");

  // 4a: Account-level insights
  console.log("  4a. Account insights ophalen (GET /{ig-user}/insights)...");
  try {
    const insights = await get(`/${igId}/insights`, pageToken, {
      metric: "reach,accounts_engaged",
      period: "day",
    });
    console.log("  ✅ Account insights SUCCESS!");
    if (insights.data) {
      for (const metric of insights.data) {
        const lastVal =
          metric.values?.[metric.values.length - 1]?.value ?? "n/a";
        console.log(`     ${metric.name}: ${lastVal}`);
      }
    }
  } catch (e) {
    console.log(`  ⚠️  Account insights mislukt: ${e.message}`);
    console.log("  (Kan komen door te weinig data - probeer media insights)\n");

    // 4b: Fallback - media-level insights
    console.log("  4b. Media insights proberen...");
    try {
      const media = await get(`/${igId}/media`, pageToken, { limit: "5" });
      if (media.data?.length) {
        const mediaId = media.data[0].id;
        console.log(`      Media gevonden: ${mediaId}`);
        const mediaInsights = await get(`/${mediaId}/insights`, pageToken, {
          metric: "reach",
        });
        console.log("  ✅ Media insights SUCCESS!");
        if (mediaInsights.data) {
          for (const metric of mediaInsights.data) {
            console.log(
              `     ${metric.name}: ${metric.values?.[0]?.value ?? "n/a"}`,
            );
          }
        }
      } else {
        console.log("  ⚠️  Geen media gevonden op dit IG account.");
        console.log("      Post eerst iets op Instagram en probeer opnieuw.");
      }
    } catch (e2) {
      console.error(`  ❌ Media insights ook mislukt: ${e2.message}`);
    }
  }

  // ── Step 5: TEST instagram_content_publish ──
  console.log("\n━━━ TEST 2: instagram_content_publish ━━━\n");

  // Gebruik een betrouwbare publieke test image
  const testImageUrl = "https://placecats.com/800/800";
  const caption = "🔧 API verification test - will be removed shortly";

  // 5a: Create media container
  console.log("  5a. Media container aanmaken (POST /{ig-user}/media)...");
  let containerId;
  try {
    const container = await post(`/${igId}/media`, pageToken, {
      image_url: testImageUrl,
      caption: caption,
    });
    containerId = container.id;
    console.log(`  ✅ Container aangemaakt: ${containerId}`);
  } catch (e) {
    console.error(`  ❌ Container aanmaken mislukt: ${e.message}`);

    if (e.message.includes("2207026")) {
      console.error(
        "\n  TIP: Dit kan komen doordat het IG account geen Business/Creator account is.",
      );
      console.error(
        "  Ga naar Instagram → Settings → Account → Switch to Professional Account",
      );
    }
    if (e.message.includes("URL")) {
      console.error(
        "\n  TIP: De test image URL is niet bereikbaar. Check je internetverbinding.",
      );
    }
    process.exit(1);
  }

  // 5b: Wait for container processing
  console.log("  5b. Wachten op processing...");
  let ready = false;
  for (let i = 1; i <= 15; i++) {
    await sleep(3000);
    try {
      const status = await get(`/${containerId}`, pageToken, {
        fields: "status_code,status",
      });
      const code = status.status_code;
      console.log(`      Poging ${i}/15 - status: ${code}`);

      if (code === "FINISHED") {
        ready = true;
        break;
      } else if (code === "ERROR") {
        console.error(`  ❌ Container processing gefaald.`);
        if (status.status) console.error(`     Details: ${status.status}`);
        process.exit(1);
      }
      // IN_PROGRESS - keep waiting
    } catch (e) {
      console.log(`      Poging ${i}/15 - check mislukt: ${e.message}`);
    }
  }

  if (!ready) {
    console.log("  ⚠️  Container nog niet klaar na 45 sec.");
    console.log("  De POST /{ig-user}/media call is WEL gelogd bij Meta.");
    console.log("  Probeer het script later opnieuw voor de publish stap.\n");
    return;
  }

  // 5c: Publish
  console.log("  5c. Publiceren (POST /{ig-user}/media_publish)...");
  try {
    const published = await post(`/${igId}/media_publish`, pageToken, {
      creation_id: containerId,
    });
    console.log(`  ✅ Gepubliceerd! Media ID: ${published.id}`);
    console.log(
      `\n  ⚠️  VERGEET NIET: verwijder de test post via de Instagram app!\n`,
    );
  } catch (e) {
    console.error(`  ❌ Publiceren mislukt: ${e.message}`);
    console.log("  De container creation call is WEL gelogd bij Meta.");
  }

  // ── Summary ──
  console.log("━━━ SAMENVATTING ━━━\n");
  console.log("  Test calls uitgevoerd. Ga nu naar:");
  const appId = process.env.META_APP_ID || "1456384356160440";
  console.log(
    `  https://developers.facebook.com/apps/${appId}/review-status/`,
  );
  console.log("");
  console.log(
    "  Het kan 5-15 minuten duren voordat Meta de calls registreert.",
  );
  console.log("  Refresh de pagina een paar keer als het niet direct werkt.");
  console.log("");
  console.log("  Als het nog steeds niet werkt:");
  console.log("  1. Check dat de permissions zijn toegevoegd aan je app");
  console.log("     (App Dashboard → App Review → Permissions and Features)");
  console.log(
    "  2. Controleer dat je het token genereerde met je APP geselecteerd",
  );
  console.log('     (niet de standaard "Graph API Explorer" app)');
  console.log("  3. Run dit script nogmaals\n");
}

main().catch((e) => {
  console.error(`\n❌ Fatal error: ${e.message}\n`);

  if (e.message.includes("expired")) {
    console.error(
      "TIP: Je access token is verlopen. Genereer een nieuwe via Graph API Explorer.",
    );
  }
  if (e.message.includes("permission")) {
    console.error(
      "TIP: Je hebt niet alle permissions geselecteerd bij het genereren van het token.",
    );
  }
  if (e.message.includes("190")) {
    console.error(
      "TIP: Token ongeldig. Genereer een nieuwe via Graph API Explorer.",
    );
    console.error(
      '     Zorg dat je APP "Ainomiq" geselecteerd is (niet "Graph API Explorer").',
    );
  }

  process.exit(1);
});
