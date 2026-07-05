import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { isDemoTenant } from '@/lib/demo';
import { getTenantConfigWithAliases, getTenantConfig, setTenantConfig, getIntegrationWithAliases } from '@/lib/db';
import { getDriveFolderMediaCounts, getDriveProductLibrary, getDriveProductLibraryFromRoot, searchDriveFolders } from '@/lib/google-drive';
import { creditErrorResponse, requireCredits, spendCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';

const MANUAL_DRIVE_LINKS_KEY = 'ad_manual_drive_links';
const DRIVE_ROOT_LINK_KEY = 'ad_drive_root_link';

function slug(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function emptyTotals() {
  return { new: { images: 0, videos: 0, total: 0 }, used: { images: 0, videos: 0, total: 0 } };
}

function normalizeCatalogName(name: string) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function tokenSet(value: string) {
  return new Set(normalizeCatalogName(value).split(' ').filter(token => token.length > 2));
}

function getDriveMatch(itemName: string, driveFolders: any[]) {
  const itemKey = normalizeCatalogName(itemName);
  if (!itemKey) return null;
  const exact = driveFolders.find(folder => normalizeCatalogName(folder.name) === itemKey);
  if (exact) return exact;

  const itemTokens = tokenSet(itemName);
  let best: { folder: any; score: number } | null = null;
  for (const folder of driveFolders) {
    const folderKey = normalizeCatalogName(folder.name);
    if (!folderKey) continue;
    let score = 0;
    if (itemKey.includes(folderKey) || folderKey.includes(itemKey)) score += 20;
    const folderTokens = tokenSet(folder.name);
    for (const token of itemTokens) {
      if (folderTokens.has(token)) score += 4;
    }
    const sharedTokens = Array.from(itemTokens).filter(token => folderTokens.has(token)).length;
    if (sharedTokens < Math.min(2, itemTokens.size)) score = 0;
    if (score > (best?.score || 0)) best = { folder, score };
  }
  return best && best.score >= 8 ? best.folder : null;
}

function attachDriveAssets(item: any, driveFolders: any[]) {
  const drive = getDriveMatch(item.name, driveFolders);
  if (!drive) return { ...item, drive: { available: false, images: 0, videos: 0, total: 0, manual: false } };
  return {
    ...item,
    drive: {
      available: Boolean(drive.photoFolderUrl || drive.videoFolderUrl || drive.url || (drive.new?.images || 0) > 0 || (drive.new?.videos || 0) > 0),
      folderId: drive.id,
      url: drive.url || '',
      photoFolderId: drive.photoFolderId || null,
      photoFolderUrl: drive.photoFolderUrl || drive.url || null,
      videoFolderId: drive.videoFolderId || null,
      videoFolderUrl: drive.videoFolderUrl || null,
      images: drive.new?.images || 0,
      videos: drive.new?.videos || 0,
      total: drive.new?.total || 0,
      manual: Boolean(drive.manual),
    },
  };
}

function parseJson(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

async function manualDriveFolders(tenantId: string) {
  const raw = await getTenantConfig(tenantId, MANUAL_DRIVE_LINKS_KEY);
  const saved = parseJson(raw) || {};
  const folders: any[] = [];
  for (const entry of Object.values(saved) as any[]) {
    const name = String(entry?.name || '').trim();
    if (!name) continue;
    const photoLink = String(entry?.photoUrl || '').trim();
    const videoLink = String(entry?.videoUrl || '').trim();
    if (!photoLink && !videoLink) continue;
    const [photo, video] = await Promise.all([
      photoLink ? getDriveFolderMediaCounts(tenantId, photoLink).catch((err) => ({ error: err instanceof Error ? err.message : 'Could not read photo folder', images: 0, videos: 0, total: 0, folderId: '', url: photoLink })) : Promise.resolve(null),
      videoLink ? getDriveFolderMediaCounts(tenantId, videoLink).catch((err) => ({ error: err instanceof Error ? err.message : 'Could not read video folder', images: 0, videos: 0, total: 0, folderId: '', url: videoLink })) : Promise.resolve(null),
    ]);
    const images = photo ? (photo.images || 0) + (photo.videos || 0) : 0;
    const videos = video ? (video.videos || 0) + (video.images || 0) : 0;
    folders.push({
      id: `manual-${entry.id || slug(name)}`,
      name,
      url: photo?.url || video?.url || '',
      manual: true,
      photoFolderId: photo?.folderId || null,
      photoFolderUrl: photo?.url || photoLink || null,
      videoFolderId: video?.folderId || null,
      videoFolderUrl: video?.url || videoLink || null,
      new: { images, videos, total: images + videos },
      used: { images: 0, videos: 0, total: 0 },
    });
  }
  return folders;
}

function brandCatalogFromProfile(profile: any, driveFolders: any[] = []) {
  const summary = profile?.source_summary || {};
  const products = Array.isArray(summary.product_catalog) ? summary.product_catalog : [];
  const collections = Array.isArray(summary.collection_catalog) ? summary.collection_catalog : [];
  const folders = products.map((product: any, index: number) => {
    const title = String(product.title || '').trim();
    const imageCount = product.image_url ? 1 : 0;
    return {
      id: `scrape-product-${slug(title)}-${index}`,
      type: 'product',
      name: title,
      url: String(product.url || ''),
      imageUrl: product.image_url || null,
      price: product.price || '',
      source: 'brand_scrape',
      new: { images: imageCount, videos: 0, total: imageCount },
      used: { images: 0, videos: 0, total: 0 },
    };
  }).filter((item: any) => item.name).map((item: any) => attachDriveAssets(item, driveFolders));
  const collectionFolders = collections.map((collection: any, index: number) => ({
    id: `scrape-collection-${slug(collection.title)}-${index}`,
    type: 'collection',
    name: String(collection.title || '').trim(),
    url: String(collection.url || ''),
    imageUrl: collection.image_url || null,
    productCount: collection.product_count ?? null,
    source: 'brand_scrape',
    new: { images: collection.image_url ? 1 : 0, videos: 0, total: collection.image_url ? 1 : 0 },
    used: { images: 0, videos: 0, total: 0 },
  })).filter((item: any) => item.name).map((item: any) => attachDriveAssets(item, driveFolders));
  return { folders, collections: collectionFolders, scrapedAt: summary.scraped_at || null, hasScrape: Boolean(summary.scraped_at || products.length || collections.length) };
}

function totalAssets(folders: any[]) {
  return folders.reduce((totals, folder) => {
    totals.new.images += folder.new?.images || 0;
    totals.new.videos += folder.new?.videos || 0;
    totals.new.total += folder.new?.total || 0;
    totals.used.images += folder.used?.images || 0;
    totals.used.videos += folder.used?.videos || 0;
    totals.used.total += folder.used?.total || 0;
    return totals;
  }, emptyTotals());
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  if (request.nextUrl.searchParams.get('mode') === 'search') {
    const query = request.nextUrl.searchParams.get('q') || '';
    const kindParam = request.nextUrl.searchParams.get('kind') || 'any';
    const kind = kindParam === 'photo' || kindParam === 'video' ? kindParam : 'any';
    if (!query.trim()) return Response.json({ folders: [] });
    try {
      const folders = await searchDriveFolders(tenantId, query, kind);
      return Response.json({ folders });
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Could not search Google Drive' }, { status: 400 });
    }
  }

  if (isDemoTenant(tenantId)) {
    return Response.json({
      totals: { new: { images: 12, videos: 4, total: 16 }, used: { images: 24, videos: 8, total: 32 } },
      folders: [
        { id: 'demo-jeans-pins', name: 'Jeans Pins', url: '', new: { images: 8, videos: 3, total: 11 }, used: { images: 18, videos: 6, total: 24 } },
        { id: 'demo-retro-watch', name: 'Retro Watch', url: '', new: { images: 4, videos: 1, total: 5 }, used: { images: 6, videos: 2, total: 8 } },
      ],
      collections: [],
      sources: {
        brand_scrape: { connected: true, scraped_at: '2026-05-02T00:00:00Z', products: 2, collections: 0 },
        google_drive: {
          connected: true,
          error: null,
          root_url: 'https://drive.google.com/drive/folders/demo',
          root_folder_count: 2,
          new_root_url: 'https://drive.google.com/drive/folders/demo',
          used_root_url: '',
        },
      },
      needs_brand_scrape: false,
    });
  }

  try {
    const rawProfile = await getTenantConfigWithAliases(tenantId, 'brand_profile');
    let profile: any = null;
    try { profile = rawProfile ? JSON.parse(rawProfile) : null; } catch {}
    let driveLibrary: any = null;
    let driveError = '';
    const savedRootUrl = (await getTenantConfig(tenantId, DRIVE_ROOT_LINK_KEY)) || '';
    const googleDriveIntegration = await getIntegrationWithAliases(tenantId, 'google_drive') || await getIntegrationWithAliases(tenantId, 'google');
    try {
      driveLibrary = savedRootUrl
        ? await getDriveProductLibraryFromRoot(tenantId, savedRootUrl)
        : await getDriveProductLibrary(tenantId);
    } catch (err) {
      driveError = err instanceof Error ? err.message : 'Google Drive is connected, but this folder could not be read';
    }

    const driveFolders = Array.isArray(driveLibrary?.folders) ? driveLibrary.folders.map((folder: any) => ({ ...folder, type: 'drive_folder', source: 'google_drive' })) : [];
    const manualFolders = await manualDriveFolders(tenantId);
    const brandCatalog = brandCatalogFromProfile(profile, [...manualFolders, ...driveFolders]);
    const folders = brandCatalog.folders;
    const totals = totalAssets(folders);
    return Response.json({
      totals,
      folders,
      collections: brandCatalog.collections,
      sources: {
        brand_scrape: { connected: brandCatalog.hasScrape, scraped_at: brandCatalog.scrapedAt, products: brandCatalog.folders.length, collections: brandCatalog.collections.length },
        google_drive: {
          connected: Boolean(googleDriveIntegration),
          error: driveError || null,
          root_url: driveLibrary?.rootUrl || savedRootUrl || '',
          root_folder_count: driveFolders.length,
          new_root_url: driveLibrary?.rootUrl || savedRootUrl || 'https://drive.google.com/drive/folders/14yfrr5LHZPS6wqcXx3AWnoanOjW0vABB',
          used_root_url: savedRootUrl ? '' : 'https://drive.google.com/drive/folders/19DwgmZM4DUF6aJNd2iZ-Brs9dc4x7Pdz',
        },
      },
      needs_brand_scrape: !brandCatalog.hasScrape,
    });
  } catch (err) {
    console.error('[Ads Content Library]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to load content library' }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body?.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  const rootUrl = String(body?.root_url || '').trim();
  if (body?.mode === 'root') {
    if (isDemoTenant(tenantId)) {
      return Response.json({ ok: true, root_url: rootUrl || 'https://drive.google.com/drive/folders/demo', folders: 2, assets: 16 });
    }
    try {
      if (!rootUrl) {
        await setTenantConfig(tenantId, DRIVE_ROOT_LINK_KEY, '');
        return Response.json({ ok: true, root_url: '' });
      }
      await requireCredits(tenantId, 'drive_scan', 1);
      const library = await getDriveProductLibraryFromRoot(tenantId, rootUrl);
      await setTenantConfig(tenantId, DRIVE_ROOT_LINK_KEY, library.rootUrl);
      await spendCredits(tenantId, 'drive_scan', 1, 'Scan Google Drive root folder');
      return Response.json({ ok: true, root_url: library.rootUrl, folders: library.folders.length, assets: library.totals.new.total });
    } catch (err) {
      const creditResponse = creditErrorResponse(err);
      if (creditResponse) return creditResponse;
      return Response.json({ error: err instanceof Error ? err.message : 'Could not read Drive root folder' }, { status: 400 });
    }
  }

  const catalogId = String(body?.catalog_id || '').trim();
  const name = String(body?.name || '').trim();
  const type = String(body?.type || 'product').trim();
  const photoUrl = String(body?.photo_url || '').trim();
  const videoUrl = String(body?.video_url || '').trim();
  if (!catalogId || !name) return Response.json({ error: 'Missing catalog item' }, { status: 400 });

  try {
    const raw = await getTenantConfig(tenantId, MANUAL_DRIVE_LINKS_KEY);
    const saved = parseJson(raw) || {};
    if (!photoUrl && !videoUrl) {
      delete saved[catalogId];
    } else {
      await requireCredits(tenantId, 'drive_scan', 1);
      if (photoUrl) await getDriveFolderMediaCounts(tenantId, photoUrl);
      if (videoUrl) await getDriveFolderMediaCounts(tenantId, videoUrl);
      saved[catalogId] = { id: catalogId, name, type, photoUrl, videoUrl, updatedAt: new Date().toISOString() };
    }
    await setTenantConfig(tenantId, MANUAL_DRIVE_LINKS_KEY, JSON.stringify(saved));
    if (photoUrl || videoUrl) await spendCredits(tenantId, 'drive_scan', 1, 'Validate Google Drive media folder');
    return Response.json({ ok: true });
  } catch (err) {
    const creditResponse = creditErrorResponse(err);
    if (creditResponse) return creditResponse;
    return Response.json({ error: err instanceof Error ? err.message : 'Could not save Drive link' }, { status: 400 });
  }
}
