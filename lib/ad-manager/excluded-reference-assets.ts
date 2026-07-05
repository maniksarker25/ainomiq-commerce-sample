/** Exclude legacy third-party ad reference rows from API responses and writes. */

const BLOCKED_TAG_MARKERS = [
  'competitor',
  'inspiration',
  'meta-library',
  'meta_library',
  'ad-library',
  'ad_library',
];

type ReferenceAssetLike = {
  source_type?: unknown;
  sourceType?: unknown;
  tags?: unknown;
  asset_url?: unknown;
  assetUrl?: unknown;
  thumbnail_url?: unknown;
  thumbnailUrl?: unknown;
  landing_page_url?: unknown;
  landingPageUrl?: unknown;
  notes?: unknown;
  name?: unknown;
};

export function parseAssetTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((tag) => String(tag || '').trim()).filter(Boolean);
  }
  const value = String(raw || '').trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag || '').trim()).filter(Boolean);
    }
  } catch {}
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tagBlob(tags: string[]) {
  return tags.map((tag) => tag.toLowerCase()).join(' ');
}

function hasBlockedTag(tags: string[]) {
  const blob = tagBlob(tags);
  return BLOCKED_TAG_MARKERS.some((marker) => blob.includes(marker));
}

function hasMetaLibraryUrl(...values: Array<unknown>) {
  return values.some((value) =>
    String(value || '').toLowerCase().includes('facebook.com/ads/library'),
  );
}

export function isExcludedReferenceAsset(input: ReferenceAssetLike) {
  if (
    hasMetaLibraryUrl(
      input.asset_url ?? input.assetUrl,
      input.thumbnail_url ?? input.thumbnailUrl,
      input.landing_page_url ?? input.landingPageUrl,
    )
  ) {
    return true;
  }

  const sourceType = String(input.source_type ?? input.sourceType ?? '').toLowerCase();
  if (sourceType !== 'external') return false;

  const tags = parseAssetTags(input.tags).map((tag) => tag.toLowerCase());
  if (hasBlockedTag(tags)) return true;
  return tags.includes('competitor') && tags.includes('saved');
}

export function assertAllowedReferenceAssetInput(input: ReferenceAssetLike) {
  if (isExcludedReferenceAsset(input)) {
    throw new Error('This asset source is not supported.');
  }
}
