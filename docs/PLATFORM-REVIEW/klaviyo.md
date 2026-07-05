# Klaviyo App Review — ainomiq Commerce

**Zwaarte: 🟢 lichter.** OAuth-app met scopes die bij installatie gevraagd worden. Een
publieke listing in de Klaviyo-directory vereist een review, maar geen security-assessment
zoals Google.

## Scopes die de code aanvraagt (uit de codebase)
| Scope | Module/gebruik |
|-------|----------------|
| `accounts:read` | Account-context |
| `campaigns:read` | Performance/Email — campagnes lezen |
| `metrics:read` | Performance — e-mailmetrics |
| `lists:read`, `lists:write` | Lijstbeheer |
| `segments:read` | Segmentatie |
| `flows:read` | Flows lezen |
| `profiles:read`, `profiles:write` | Profielen |
| `events:write` | Events sturen |

> 💡 `lists:write` en `profiles:write` raken PII. Verantwoorden per module; schrappen als
> alleen-lezen volstaat voor de feature.

## Vereisten
1. OAuth-app aangemaakt in Klaviyo met redirect-URI's en de bovenstaande scopes.
2. Token-refresh (✅ in code, 5 min buffer) en encryptie at rest (✅ v2).
3. Voor directory-listing: app-omschrijving, privacy policy, support-contact, en de review doorlopen.

## Checklist
- [ ] OAuth-app + scopes geconfigureerd
- [ ] Scopes geminimaliseerd
- [ ] Listing-content (indien publieke directory gewenst)
- [ ] Test-install op een Klaviyo-account
