# Google OAuth Verification — ainomiq Commerce

**Zwaarte: 🔴 hoogst.** Reden: we gebruiken *restricted* scopes (Gmail, Drive). Die
vereisen naast OAuth-verificatie een jaarlijkse onafhankelijke **CASA security-assessment**
(Tier 2), die geld en tijd kost.

## Scopes die de code aanvraagt (uit de codebase)
| Scope | Tier | Module/gebruik |
|-------|------|----------------|
| `gmail.readonly` | Restricted | Intelli Support — inkomende mail lezen |
| `gmail.send` | Restricted | Intelli Support — antwoorden sturen |
| `gmail.modify` | Restricted | Intelli Support — labels/lees-status |
| `drive` (full) | Restricted | Creative OS — bronmateriaal |
| `analytics.readonly` | Sensitive | Performance |
| `adwords` | Sensitive | Logic Ads (Google Ads) |
| `calendar`, `calendar.events`, `calendar.readonly` | Sensitive | Content/planning |
| `contacts.readonly` | Sensitive | — (verifieer of nog gebruikt) |
| `tasks` | Sensitive | — (verifieer of nog gebruikt) |
| `userinfo.email`, `userinfo.profile` | Basis | Login |

## Vereisten voor goedkeuring
1. **OAuth consent screen** volledig: app-naam, logo, support-mail, geautoriseerde domeinen, links naar privacy & terms.
2. **Domein-eigendom** verifiëren in Google Search Console.
3. **Brand verificatie** + demovideo per restricted/sensitive scope (laten zien wat de scope doet en waarom nodig).
4. **CASA Tier 2 assessment** (restricted scopes): onafhankelijke security-assessor, jaarlijks te herhalen. Plan hier weken + budget voor.

## 💡 Aanbevolen scope-minimalisatie (verlaagt review-zwaarte en kosten)
- **`gmail.modify` → schrappen** als we alleen lezen + sturen. `gmail.readonly` + `gmail.send` dekken Intelli Support waarschijnlijk volledig. Scheelt de breedste Gmail-scope.
- **`drive` (full) → `drive.file`** als Creative OS alleen werkt met bestanden die de app zelf aanmaakt/opent. Full `drive` is de zwaarst te verantwoorden scope. Als we echt bestaande mappen moeten lezen, houden — maar dat expliciet onderbouwen.
- **`contacts.readonly` / `tasks`**: bevestigen of nog in gebruik; zo niet, verwijderen uit de OAuth-aanvraag (elke ongebruikte scope vertraagt review).

## Checklist
- [ ] Consent screen ingevuld + privacy/terms-links live
- [ ] Domein geverifieerd
- [ ] Scopes geminimaliseerd (zie boven), code aangepast waar nodig
- [ ] Demovideo per scope
- [ ] CASA-assessor geselecteerd en ingepland
- [ ] Business-verificatiegegevens klaar (gedeeld met Meta)
