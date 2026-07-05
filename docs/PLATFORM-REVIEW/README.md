# Platform Review Readiness — ainomiq Commerce

Doel: alle scopes die we gebruiken goedgekeurd krijgen bij Meta, Shopify, Google en
Klaviyo (en later TikTok/Snapchat), en het platform klaar maken voor ~10.000 gebruikers.

> **Belangrijk — verwachtingen.** Wij kunnen niet "goedkeuring aanzetten". Elk platform
> heeft een eigen review-/verificatieproces dat ainomiq indient en dat dagen tot weken
> duurt. Deze docs maken ons *indien-klaar*: per platform de exacte scopes, de
> onderbouwing per scope, en de checklist van wat het platform eist. De scopes hieronder
> zijn uit de echte code gehaald (niet verzonnen).

## Statusoverzicht
| Platform | Review-zwaarte | Grootste blokker | Doorlooptijd (indicatie) | Doc |
|----------|----------------|------------------|--------------------------|-----|
| **Google** | 🔴 Zwaarst | Restricted scopes (Gmail/Drive) → jaarlijkse CASA security-assessment (betaald) | 4–8 wkn + assessment | [google.md](google.md) |
| **Meta** | 🟠 Zwaar | Business verificatie + App Review per scope met screencast | 2–6 wkn | [meta.md](meta.md) |
| **Shopify** | 🟠 Zwaar | Protected customer data-aanvraag + verplichte GDPR-webhooks | 2–4 wkn | [shopify.md](shopify.md) |
| **Klaviyo** | 🟢 Lichter | Publieke app-review voor directory-listing | 1–3 wkn | [klaviyo.md](klaviyo.md) |
| **TikTok Ads** | 🟠 Onbekend | Marketing API developer-approval | n.t.b. | [tiktok-ads.md](tiktok-ads.md) |
| **Snapchat Ads** | 🟠 Onbekend | Marketing API access-aanvraag | n.t.b. | [snapchat-ads.md](snapchat-ads.md) |

## Gedeelde vereisten (gelden voor bijna elk platform)
Deze hebben we al — verifieer dat ze live en correct zijn vóór indienen:
- ✅ **Privacy policy** — `app/privacy-policy/page.tsx`
- ✅ **Terms of service** — `app/terms-of-service/page.tsx`
- ✅ **Data deletion** — pagina `app/data-deletion/` + endpoint `app/api/data-deletion/route.ts`
- ⬜ **Business verificatie** (Meta + Google): KvK-gegevens, domein-eigendom, evt. DUNS.
- ⬜ **Demo-omgeving + screencasts**: reviewers willen elke scope in actie zien. Maak per platform een testaccount met echte (test)data.
- ⬜ **Scope-minimalisatie**: vraag alleen wat een module gebruikt. Minder/lichtere scopes = snellere review. Zie de aanbevelingen per platform.

## Aanbevolen volgorde
1. **Google eerst starten** (langste doorlooptijd door CASA). Overweeg scopes te verkleinen om de assessment-zwaarte te verlagen — zie google.md.
2. **Parallel**: business-verificatie bij Meta + Google (zelfde KvK-bewijs).
3. **Shopify**: GDPR-webhooks implementeren (verplicht), dan protected-data-aanvraag.
4. **Klaviyo**: lichtste, kan later.
5. **TikTok/Snapchat**: pas oppakken als de kern-vier door de review zijn.

Schaalbaarheid naar 10k gebruikers: zie [SCALING-10K.md](SCALING-10K.md).
