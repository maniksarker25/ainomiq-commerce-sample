# Snapchat Ads (Marketing API) — ainomiq Commerce

**Status: geplande integratie.** Stond als "Coming Soon" in de spec. v2 bevat een
gescaffolde stub (`lib/snapchat-ads.ts`).

## Wat nodig is
1. **Snap Business-account** + een app in de Snap Developer Portal (Marketing API).
2. **OAuth 2.0**: Snapchat Marketing API gebruikt OAuth met `snapchat-marketing-api`-scope; organisatie-/ad-account-authorisatie.
3. **Access-aanvraag**: toegang tot de Marketing API kan goedkeuring vereisen afhankelijk van het use-case (campagnebeheer, reporting).

## Aanpak (tech lead)
- Zelfde patroon als Meta/TikTok: versleutelde token-opslag, refresh, rate-limits.
- Adapter achter de Logic Ads-interface zodat het naast Meta/TikTok hangt.

## Checklist
- [ ] Snap Business-account + app
- [ ] OAuth-flow + versleutelde token-opslag
- [ ] Marketing API access bevestigd
- [ ] Adapter achter de Logic Ads-interface
