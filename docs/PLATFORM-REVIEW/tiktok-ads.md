# TikTok Ads (Marketing API) — ainomiq Commerce

**Status: geplande integratie.** In de originele spec stond TikTok Ads als "Coming Soon".
Er is nog geen werkende integratie; v2 bevat een gescaffolde stub (`lib/tiktok-ads.ts`).

## Wat nodig is
1. **TikTok for Business developer-account** + een app in het TikTok Marketing API-portaal.
2. **API-toegang aanvragen**: Marketing API access is approval-gated; je dient een use-case in (campaign management, reporting). Doorlooptijd onbekend — vroeg starten.
3. **OAuth 2.0**: `auth.tiktokglobalshop`/`business-api` flow; advertiser-authorisatie.
4. **Scopes/permissions** (afhankelijk van use-case): Ad Account Management, Reporting, Campaign/AdGroup/Ad management, Audience. Vraag alleen wat Logic Ads/Performance nodig heeft.

## Aanpak (tech lead)
- Volg het bestaande integratie-patroon (zie `lib/meta.ts`): token-opslag versleuteld via `lib/encryption.ts`, refresh-logica, rate-limit-afhandeling.
- Bouw de adapter achter dezelfde module-interface als Meta, zodat Logic Ads provider-agnostisch wordt.

## Checklist
- [ ] Developer-account + app
- [ ] Marketing API access-aanvraag ingediend
- [ ] OAuth-flow + versleutelde token-opslag
- [ ] Scopes geminimaliseerd en onderbouwd
- [ ] Adapter achter de Logic Ads-interface
