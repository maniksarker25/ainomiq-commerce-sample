# Shopify App Review — ainomiq Commerce

**Zwaarte: 🟠 zwaar.** We lezen klant- en order-PII (`read_customers`, `read_orders`),
dus we vallen onder Shopify's **Protected Customer Data**-regels, én er zijn drie
verplichte GDPR-webhooks die nu nog ontbreken.

## Scopes die de code aanvraagt (uit de codebase)
**Read:** `read_analytics`, `read_content`, `read_customers`, `read_discounts`,
`read_draft_orders`, `read_engagement`, `read_fulfillments`, `read_gift_cards`,
`read_id`, `read_insights`, `read_inventory`, `read_locales`, `read_locations`,
`read_markets`, `read_orders`, `read_price_rules`, `read_products`, `read_reports`,
`read_returns`, `read_shipping`, `read_themes`, `read_user_content`
**Write:** `write_customers`, `write_discounts`, `write_draft_orders`,
`write_fulfillments`, `write_gift_cards`, `write_inventory`, `write_orders`,
`write_price_rules`

> 💡 Dit is een brede set. Shopify-review kijkt kritisch naar write-scopes en PII.
> **Per module verantwoorden of schrappen** — vraag niet `write_orders` aan als geen
> module orders aanmaakt. Minder scopes = snellere goedkeuring.

## Verplicht: 3 GDPR-webhooks (ontbreken nu — blokker)
Shopify weigert apps zonder deze endpoints. Toevoegen onder `app/api/webhooks/shopify/`:
- `customers/data_request` — klant vraagt zijn data op
- `customers/redact` — klant-data verwijderen
- `shop/redact` — winkel-data verwijderen (48u na uninstall)
Alle drie met HMAC-signature-verificatie. (Zie tech-lead-brief; dit is afgebakend werk.)

## Protected Customer Data
- In Partner Dashboard de **protected customer data**-aanvraag invullen: welke datavelden, waarom, hoe beveiligd (encryptie at rest ✅, toegangscontrole, retentie).
- Data-minimalisatie en een dataprotectie-beleid aantonen.

## Distributiekeuze
- **Public app** (App Store-listing) → volledige app-review. Of
- **Custom/closed app** per klant → lichter, maar niet schaalbaar naar veel klanten.
  Voor 10k gebruikers richten we op een public app.

## Checklist
- [ ] 3 GDPR-webhooks geïmplementeerd + HMAC-verificatie
- [ ] Scopes per module verantwoord / overbodige geschrapt
- [ ] Protected customer data-aanvraag ingediend
- [ ] OAuth-flow getest met een development store
- [ ] App-listing content (indien public)
