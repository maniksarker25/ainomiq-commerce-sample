/** Default geo when a publish plan omits targeting - Netherlands-first launch. */
export const DEFAULT_PUBLISH_COUNTRIES = ["NL"] as const;

export type TemplateAdset = {
  optimization_goal?: string;
  billing_event?: string;
  promoted_object?: Record<string, unknown>;
  bid_strategy?: string;
  bid_amount?: string;
  targeting?: Record<string, unknown>;
};

function clean(value: unknown, max = 240) {
  return String(value || "")
    .trim()
    .replace(/[\u2014\u2013]/g, " - ")
    .slice(0, max);
}

export function objectiveForMeta(value: unknown) {
  const normalized = clean(value, 60).toLowerCase();
  if (normalized.includes("lead")) return "OUTCOME_LEADS";
  if (normalized.includes("aware") || normalized.includes("reach"))
    return "OUTCOME_AWARENESS";
  if (normalized.includes("traffic") || normalized.includes("click"))
    return "OUTCOME_TRAFFIC";
  if (normalized.includes("outcome")) return normalized.toUpperCase();
  return "OUTCOME_SALES";
}

export function hasUsableBidAmount(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const numeric = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) && numeric > 0;
}

function bidStrategyNeedsAmount(strategy: unknown) {
  return ["TARGET_COST", "LOWEST_COST_WITH_BID_CAP"].includes(
    String(strategy || "")
      .trim()
      .toUpperCase(),
  );
}

export function adsetDefaultsForObjective(
  objective: string,
  template?: TemplateAdset | null,
) {
  const defaults: Record<string, unknown> = {};
  if (template?.optimization_goal)
    defaults.optimization_goal = template.optimization_goal;
  if (template?.billing_event) defaults.billing_event = template.billing_event;
  if (
    template?.promoted_object &&
    Object.keys(template.promoted_object).length
  ) {
    defaults.promoted_object = template.promoted_object;
  }
  if (template?.bid_strategy) {
    const strategy = String(template.bid_strategy).trim().toUpperCase();
    const needsBidAmount = bidStrategyNeedsAmount(strategy);
    if (!needsBidAmount || hasUsableBidAmount(template.bid_amount)) {
      defaults.bid_strategy = strategy;
      if (hasUsableBidAmount(template.bid_amount))
        defaults.bid_amount = String(template.bid_amount).trim();
    }
  }
  if (defaults.optimization_goal && defaults.billing_event) return defaults;
  if (objective === "OUTCOME_AWARENESS") {
    return {
      optimization_goal: defaults.optimization_goal || "REACH",
      billing_event: defaults.billing_event || "IMPRESSIONS",
      ...(defaults.promoted_object
        ? { promoted_object: defaults.promoted_object }
        : {}),
    };
  }
  if (objective === "OUTCOME_TRAFFIC") {
    return {
      optimization_goal: defaults.optimization_goal || "LINK_CLICKS",
      billing_event: defaults.billing_event || "IMPRESSIONS",
      ...(defaults.promoted_object
        ? { promoted_object: defaults.promoted_object }
        : {}),
    };
  }
  if (objective === "OUTCOME_LEADS") {
    return {
      optimization_goal: defaults.optimization_goal || "LEAD_GENERATION",
      billing_event: defaults.billing_event || "IMPRESSIONS",
      ...(defaults.promoted_object
        ? { promoted_object: defaults.promoted_object }
        : {}),
    };
  }
  return {
    optimization_goal: defaults.optimization_goal || "OFFSITE_CONVERSIONS",
    billing_event: defaults.billing_event || "IMPRESSIONS",
    ...(defaults.promoted_object
      ? { promoted_object: defaults.promoted_object }
      : {}),
  };
}

export function countriesFromMarkets(value: unknown) {
  const map: Record<string, string> = {
    netherlands: "NL",
    nederland: "NL",
    nl: "NL",
    belgium: "BE",
    belgie: "BE",
    be: "BE",
    germany: "DE",
    duitsland: "DE",
    de: "DE",
    france: "FR",
    frankrijk: "FR",
    fr: "FR",
    spain: "ES",
    es: "ES",
    italy: "IT",
    it: "IT",
    europe: "NL",
    worldwide: "US",
    world: "US",
    usa: "US",
    "united states": "US",
  };
  const parts = clean(value, 400)
    .toLowerCase()
    .split(/[,/|+&\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const found = Array.from(
    new Set(parts.map((part) => map[part]).filter(Boolean)),
  );
  return found;
}

export function buildTargeting(
  template: TemplateAdset | null | undefined,
  markets: unknown,
  options?: { defaultCountries?: string[] },
) {
  if (template?.targeting && Object.keys(template.targeting).length)
    return template.targeting;
  const countries = countriesFromMarkets(markets);
  const resolved = countries.length
    ? countries
    : options?.defaultCountries || [];
  if (!resolved.length) return null;
  return { geo_locations: { countries: resolved }, age_min: 18, age_max: 65 };
}

export function resolveAdsetTargeting(
  planJson: Record<string, unknown>,
  adsetConfig?: Record<string, unknown>,
) {
  const adsetTargeting = adsetConfig?.targeting;
  if (
    adsetTargeting &&
    typeof adsetTargeting === "object" &&
    Object.keys(adsetTargeting).length > 0
  ) {
    return adsetTargeting as Record<string, unknown>;
  }

  const template = planJson.targeting_template_adset as
    | TemplateAdset
    | undefined;
  if (template?.targeting && Object.keys(template.targeting).length > 0) {
    return template.targeting;
  }

  const markets =
    adsetConfig?.markets ??
    planJson.markets ??
    (planJson.campaign as Record<string, unknown> | undefined)?.markets;
  const fromMarkets = buildTargeting(template || null, markets, {
    defaultCountries: [...DEFAULT_PUBLISH_COUNTRIES],
  });
  if (fromMarkets) return fromMarkets;

  return {
    geo_locations: { countries: [...DEFAULT_PUBLISH_COUNTRIES] },
    age_min: 18,
    age_max: 65,
  };
}

export function conversionPromotedObject(
  pixelId: string,
  optimizationGoal: unknown,
) {
  if (String(optimizationGoal || "") !== "OFFSITE_CONVERSIONS") return null;
  return { pixel_id: pixelId, custom_event_type: "PURCHASE" };
}
