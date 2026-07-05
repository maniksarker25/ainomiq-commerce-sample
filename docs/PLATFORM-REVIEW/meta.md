# Meta App Review — ainomiq Commerce

**Zwaarte: 🟠 zwaar.** Advanced Access op ads-, pages- en instagram-scopes vereist App
Review + business-verificatie. Zonder review werkt alleen Standard Access (eigen
testgebruikers), niet je klanten.

## Scopes die de code aanvraagt (uit de codebase)
| Scope | Module/gebruik | Access-niveau |
|-------|----------------|---------------|
| `ads_management`, `ads_read` | Logic Ads — campagnes lezen/beheren | Advanced |
| `business_management` | Business-assets koppelen | Advanced |
| `read_insights` | Performance — ad/page-insights | Advanced |
| `pages_show_list`, `pages_read_engagement`, `pages_read_user_content` | Pagina's lezen | Advanced |
| `pages_manage_posts`, `pages_manage_engagement`, `pages_manage_metadata` | Content Studio — posten/beheren | Advanced |
| `pages_messaging` | Intelli Support — DM's | Advanced |
| `instagram_basic`, `instagram_business_account` | IG-account koppelen | Advanced |
| `instagram_business_content_publish` / `instagram_content_publish` | Content Studio — IG posten | Advanced |
| `instagram_business_manage_messages` / `instagram_manage_messages` | Intelli Support — IG DM's | Advanced |
| `instagram_business_manage_comments` / `instagram_manage_comments` | Comment-beheer | Advanced |
| `email`, `public_profile` | Login | Standard |

> ⚠️ Let op: de code mengt oude (`instagram_manage_*`) en nieuwe (`instagram_business_manage_*`)
> scopenamen. Meta migreert naar de `instagram_business_*` set. **Opschonen naar één
> consistente set** vóór indienen — dubbele/verouderde scopes geven review-afwijzingen.

## Vereisten
1. **Business verificatie** (KvK + domein) — verplicht voor Advanced Access.
2. **App Review per scope**: screencast die de feature toont, plus tekstuele use-case.
3. **Webhooks**: signature-verificatie (✅ Instagram in v2 gedaan), data-deletion callback (✅ endpoint aanwezig).
4. **Privacy policy + data deletion URL** in app-instellingen (✅ aanwezig).

## Checklist
- [ ] Instagram-scopes geconsolideerd naar `instagram_business_*` set (code + aanvraag)
- [ ] Business verificatie ingediend
- [ ] Testgebruikers + demodata voor screencasts
- [ ] Screencast + use-case per Advanced-scope
- [ ] Data deletion callback-URL ingevuld in App Dashboard
