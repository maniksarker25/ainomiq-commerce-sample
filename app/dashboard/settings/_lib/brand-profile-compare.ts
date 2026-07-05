import { BrandProfile } from './types';

/** Fields compared to detect unsaved edits vs last saved / loaded profile. */
export function serializeBrandProfileForCompare(profile: BrandProfile): string {
  return JSON.stringify({
    brand_name: profile.brand_name || '',
    website: profile.website || '',
    what_you_sell: profile.what_you_sell || '',
    ideal_customer: profile.ideal_customer || '',
    customer_problem: profile.customer_problem || '',
    main_offer: profile.main_offer || '',
    proof_points: profile.proof_points || '',
    competitors: profile.competitors || '',
    brand_purpose: profile.brand_purpose || '',
    brand_tone: profile.brand_tone || '',
    visual_style: profile.visual_style || '',
    content_goals: profile.content_goals || '',
    logo_url: profile.logo_url || '',
    icon_url: profile.icon_url || '',
    full_logo_url: profile.full_logo_url || '',
    source_summary: profile.source_summary ?? null,
  });
}

export function brandProfilesEqual(a: BrandProfile, b: BrandProfile): boolean {
  return serializeBrandProfileForCompare(a) === serializeBrandProfileForCompare(b);
}
