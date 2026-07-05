import { listCreativeLibraryAssets } from '@/lib/ad-manager/db';

export type AssetLibraryStats = {
  total: number;
  ready: number;
  needsReview: number;
  archived: number;
  new: { images: number; videos: number; total: number };
  used: { images: number; videos: number; total: number };
  updatedAt: string;
};

export async function getAssetLibraryStats(tenantId: string): Promise<AssetLibraryStats> {
  const assets = await listCreativeLibraryAssets(tenantId, { includeArchived: true, limit: 5000 });
  const stats: AssetLibraryStats = {
    total: assets.length,
    ready: 0,
    needsReview: 0,
    archived: 0,
    new: { images: 0, videos: 0, total: 0 },
    used: { images: 0, videos: 0, total: 0 },
    updatedAt: new Date().toISOString(),
  };

  for (const asset of assets) {
    const status = String(asset.status || 'ready');
    if (status === 'archived') {
      stats.archived += 1;
      continue;
    }
    if (status === 'needs_review') stats.needsReview += 1;
    else stats.ready += 1;

    const tags = parseTags(asset.tags);
    const bucket = tags.includes('used') || tags.includes('approved') ? stats.used : stats.new;
    if (String(asset.type || 'image') === 'video') bucket.videos += 1;
    else bucket.images += 1;
    bucket.total = bucket.images + bucket.videos;
  }

  return stats;
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(',').map(tag => tag.trim()).filter(Boolean);
  }
}
