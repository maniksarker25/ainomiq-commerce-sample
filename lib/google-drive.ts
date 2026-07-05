import { createCreativeLibraryAsset } from "@/lib/ad-manager/db";
import { uploadBufferToCreativeLibraryStorage } from "@/lib/creative-library/storage";
import { getIntegrationWithAliases, upsertIntegration } from "@/lib/db";

/**
 * Google Drive API helper - fetches live content counts from Drive folders.
 */

const DRIVE_FOLDERS = {
  new: {
    root: "14yfrr5LHZPS6wqcXx3AWnoanOjW0vABB",
    img: "1PvGJlO2Gr5xA_OsCm4vG620DQ_HJ7lct",
    vid: "1GJYkTsZqkpZ6aOBVNBYD1JFgD67XXqi_",
  },
  used: {
    root: "19DwgmZM4DUF6aJNd2iZ-Brs9dc4x7Pdz",
    img: "1QkdKvV9irXhOcwRZcp7H1_i74MPIU38T",
    vid: "1nyhTS9E-E5x-gpvEt0dSZYUoY_FHNIBS",
  },
};

async function refreshGoogleAccessToken(
  tenantId: string,
  refreshToken: string,
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Google OAuth credentials not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token)
    throw new Error(
      data.error_description || data.error || "Failed to refresh Google token",
    );

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;
  const integration =
    (await getIntegrationWithAliases(tenantId, "google_drive")) ||
    (await getIntegrationWithAliases(tenantId, "google"));
  await upsertIntegration(
    tenantId,
    "google_drive",
    data.access_token,
    refreshToken,
    expiresAt,
    integration?.scopes as string | null,
    integration?.provider_account_id as string | null,
    integration?.provider_email as string | null,
  );
  return data.access_token;
}

async function getAccessToken(tenantId?: string): Promise<string> {
  if (tenantId) {
    const integration =
      (await getIntegrationWithAliases(tenantId, "google_drive")) ||
      (await getIntegrationWithAliases(tenantId, "google"));
    if (!integration)
      throw new Error("Google Drive is not connected for this account");

    const expiresAt = integration.token_expires_at
      ? new Date(String(integration.token_expires_at)).getTime()
      : 0;
    const accessToken = String(integration.access_token || "");
    const refreshToken = integration.refresh_token
      ? String(integration.refresh_token)
      : "";
    if (
      refreshToken &&
      (!accessToken || !expiresAt || Date.now() > expiresAt - 60_000)
    ) {
      return refreshGoogleAccessToken(tenantId, refreshToken);
    }
    if (accessToken) return accessToken;
    throw new Error("Google Drive token is missing. Reconnect Google.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth credentials not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to refresh Google token");
  return data.access_token;
}

async function countFilesInFolder(
  folderId: string,
  token: string,
  recursive = true,
): Promise<{ images: number; videos: number }> {
  let images = 0;
  let videos = 0;
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(mimeType)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await res.json();

    for (const file of data.files || []) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        if (recursive) {
          const sub = await countFilesInFolder(file.id, token, true);
          images += sub.images;
          videos += sub.videos;
        }
      } else if (file.mimeType?.startsWith("video/")) {
        videos++;
      } else if (file.mimeType?.startsWith("image/")) {
        images++;
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { images, videos };
}

export interface DriveContentCounts {
  new: { images: number; videos: number; total: number };
  used: { images: number; videos: number; total: number };
}

export interface DriveProductFolder {
  id: string;
  name: string;
  url: string;
  matchPath?: string;
  photoFolderId?: string;
  photoFolderUrl?: string;
  videoFolderId?: string;
  videoFolderUrl?: string;
  new: { images: number; videos: number; total: number };
  used: { images: number; videos: number; total: number };
}

export interface ImportedCreativeOsDriveSource {
  originalFileId: string;
  copiedFileId: string;
  name: string;
  importName?: string;
  importUrl?: string;
  importSourceUrl?: string;
  sourceFolderPath?: string;
  mimeType: string;
  type: "image" | "video";
  originalUrl: string;
  copiedUrl: string;
  thumbnailUrl?: string;
  backendFolderId: string;
  backendFolderUrl: string;
}

export interface ImportedDriveLibrarySource {
  originalFileId: string;
  assetId: string;
  name: string;
  importName?: string;
  importUrl?: string;
  importSourceUrl?: string;
  sourceFolderPath?: string;
  mimeType: string;
  fileSize?: number | null;
  type: "image" | "video";
  originalUrl: string;
  assetUrl: string;
  thumbnailUrl?: string;
  backendFolderId: string;
  backendFolderUrl: string;
}

export interface CreativeOsDriveStructure {
  rootFolderId: string;
  rootFolderUrl: string;
  productFolderId: string;
  productFolderUrl: string;
  readyFolderId: string;
  readyFolderUrl: string;
  photoFolderId: string;
  photoFolderUrl: string;
  videoFolderId: string;
  videoFolderUrl: string;
  usedFolderId: string;
  usedFolderUrl: string;
  usedPhotoFolderId: string;
  usedPhotoFolderUrl: string;
  usedVideoFolderId: string;
  usedVideoFolderUrl: string;
}

type CreativeOsDriveStructureOptions = {
  productFolderId?: string;
  readyFolderId?: string;
};

type KnownCreativeOsDriveCopy = {
  originalFileId?: string;
  copiedFileId?: string;
};

// Simple in-memory cache (5 min TTL) to avoid hitting Drive API on every dashboard refresh
let cache: { data: DriveContentCounts; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getDriveContentCounts(): Promise<DriveContentCounts> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }

  const token = await getAccessToken();

  const [newCounts, usedCounts] = await Promise.all([
    countFilesInFolder(DRIVE_FOLDERS.new.root, token),
    countFilesInFolder(DRIVE_FOLDERS.used.root, token),
  ]);

  const result: DriveContentCounts = {
    new: { ...newCounts, total: newCounts.images + newCounts.videos },
    used: { ...usedCounts, total: usedCounts.images + usedCounts.videos },
  };

  cache = { data: result, ts: Date.now() };
  return result;
}

async function listFolders(
  folderId: string,
  token: string,
): Promise<Array<{ id: string; name: string; webViewLink?: string }>> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
    fields: "files(id,name,webViewLink)",
    pageSize: "1000",
    orderBy: "name",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Failed to list Drive folders");
  return data.files || [];
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function findMediaFolder(
  folders: Array<{ id: string; name: string; webViewLink?: string }>,
  type: "photo" | "video",
) {
  const names =
    type === "photo"
      ? ["photo", "photos", "image", "images", "img", "foto", "fotos"]
      : ["video", "videos", "vid", "reel", "reels"];
  return (
    folders.find((folder) => names.includes(normalizeName(folder.name))) || null
  );
}

type DriveFolderNode = {
  id: string;
  name: string;
  webViewLink?: string;
  path: string[];
  depth: number;
};

const PRODUCT_IGNORE_NAMES = new Set([
  "photo",
  "photos",
  "image",
  "images",
  "img",
  "foto",
  "fotos",
  "video",
  "videos",
  "vid",
  "reel",
  "reels",
  "content",
  "assets",
  "asset",
  "used",
  "new",
  "archive",
  "archief",
  "old",
  "done",
  "ready",
  "raw",
  "edited",
]);

async function scanFolderTree(
  rootId: string,
  token: string,
  maxDepth = 4,
  maxFolders = 250,
): Promise<DriveFolderNode[]> {
  const queue: DriveFolderNode[] = [
    { id: rootId, name: "Root", path: [], depth: 0 },
  ];
  const folders: DriveFolderNode[] = [];
  while (queue.length && folders.length < maxFolders) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    const children = await listFolders(current.id, token).catch(() => []);
    for (const child of children) {
      const node: DriveFolderNode = {
        ...child,
        path: [...current.path, child.name],
        depth: current.depth + 1,
      };
      folders.push(node);
      if (folders.length >= maxFolders) break;
      queue.push(node);
    }
  }
  return folders;
}

function mediaTypeFromPath(path: string[]): "photo" | "video" | null {
  for (const part of path) {
    const normalized = normalizeName(part);
    if (["video", "videos", "vid", "reel", "reels"].includes(normalized))
      return "video";
    if (
      ["photo", "photos", "image", "images", "img", "foto", "fotos"].includes(
        normalized,
      )
    )
      return "photo";
  }
  return null;
}

function productNameFromPath(path: string[]) {
  const candidates = path.filter((part) => {
    const normalized = normalizeName(part);
    return normalized && !PRODUCT_IGNORE_NAMES.has(normalized);
  });
  return (
    candidates[candidates.length - 1] || path[path.length - 1] || "Drive folder"
  );
}

async function buildSmartDriveProductFolders(
  token: string,
  rootId: string,
): Promise<DriveProductFolder[]> {
  const nodes = await scanFolderTree(rootId, token);
  const byProduct = new Map<
    string,
    {
      name: string;
      photo?: DriveFolderNode;
      video?: DriveFolderNode;
      direct?: DriveFolderNode;
      paths: string[];
    }
  >();

  for (const node of nodes) {
    const mediaType = mediaTypeFromPath(node.path);
    const name = productNameFromPath(node.path);
    const key = normalizeName(name);
    if (!key) continue;
    const item = byProduct.get(key) || { name, paths: [] };
    item.paths.push(node.path.join(" / "));
    if (mediaType === "photo") {
      if (!item.photo || node.path.length > item.photo.path.length)
        item.photo = node;
    } else if (mediaType === "video") {
      if (!item.video || node.path.length > item.video.path.length)
        item.video = node;
    } else {
      const nodeName = normalizeName(node.name);
      if (!PRODUCT_IGNORE_NAMES.has(nodeName)) {
        if (!item.direct || node.path.length > item.direct.path.length)
          item.direct = node;
      }
    }
    byProduct.set(key, item);
  }

  const productItems = Array.from(byProduct.values())
    .filter((item) => item.photo || item.video || item.direct)
    .slice(0, 100);
  const folders = await Promise.all(
    productItems.map(async (item) => {
      const direct = item.direct || item.photo || item.video!;
      const [photoCounts, videoCounts, directCounts] = await Promise.all([
        item.photo
          ? countFilesInFolder(item.photo.id, token, true)
          : Promise.resolve({ images: 0, videos: 0 }),
        item.video
          ? countFilesInFolder(item.video.id, token, true)
          : Promise.resolve({ images: 0, videos: 0 }),
        item.photo || item.video
          ? Promise.resolve({ images: 0, videos: 0 })
          : countFilesInFolder(direct.id, token, true),
      ]);
      const images = item.photo
        ? photoCounts.images + photoCounts.videos
        : directCounts.images;
      const videos = item.video
        ? videoCounts.images + videoCounts.videos
        : directCounts.videos;
      return {
        id: direct.id,
        name: item.name,
        url:
          direct.webViewLink ||
          `https://drive.google.com/drive/folders/${direct.id}`,
        matchPath: (item.direct || item.photo || item.video)?.path.join(" / "),
        photoFolderId: item.photo?.id,
        photoFolderUrl: item.photo?.webViewLink,
        videoFolderId: item.video?.id,
        videoFolderUrl: item.video?.webViewLink,
        new: { images, videos, total: images + videos },
        used: { images: 0, videos: 0, total: 0 },
      };
    }),
  );
  folders.sort(
    (a, b) => b.new.total - a.new.total || a.name.localeCompare(b.name),
  );
  return folders;
}

export function extractDriveFolderId(input: string) {
  const value = String(input || "").trim();
  if (!value) return "";
  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const idParamMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value;
  return "";
}

export function extractDriveFileId(input: string) {
  const value = String(input || "").trim();
  if (!value) return "";
  const fileMatch = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const openMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return openMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value;
  return "";
}

function escapeDriveQuery(value: string) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

export async function searchDriveFolders(
  tenantId: string,
  query: string,
  kind: "photo" | "video" | "any" = "any",
): Promise<Array<{ id: string; name: string; url: string; path?: string }>> {
  const token = await getAccessToken(tenantId);
  const cleanQuery = normalizeName(query)
    .split(" ")
    .filter((token) => token.length > 1)
    .slice(0, 5);
  const kindTerms =
    kind === "photo"
      ? ["photo", "photos", "image", "images", "foto", "fotos"]
      : kind === "video"
        ? ["video", "videos", "reel", "reels"]
        : [];
  const terms = Array.from(new Set([...cleanQuery, ...kindTerms])).slice(0, 8);
  const nameFilter = terms.length
    ? ` and (${terms.map((term) => `name contains '${escapeDriveQuery(term)}'`).join(" or ")})`
    : "";
  const params = new URLSearchParams({
    q: `trashed=false and mimeType='application/vnd.google-apps.folder'${nameFilter}`,
    fields: "files(id,name,webViewLink)",
    pageSize: "20",
    orderBy: "name",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Failed to search Drive folders");
  return (data.files || []).map(
    (folder: { id: string; name: string; webViewLink?: string }) => ({
      id: folder.id,
      name: folder.name,
      url:
        folder.webViewLink ||
        `https://drive.google.com/drive/folders/${folder.id}`,
    }),
  );
}

export async function getDriveFolderMediaCounts(
  tenantId: string,
  folderUrlOrId: string,
): Promise<{
  folderId: string;
  url: string;
  images: number;
  videos: number;
  total: number;
}> {
  const folderId = extractDriveFolderId(folderUrlOrId);
  if (!folderId) throw new Error("Paste a valid Google Drive folder link");
  const token = await getAccessToken(tenantId);
  const counts = await countFilesInFolder(folderId, token, true);
  return {
    folderId,
    url: `https://drive.google.com/drive/folders/${folderId}`,
    images: counts.images,
    videos: counts.videos,
    total: counts.images + counts.videos,
  };
}

async function findChildFolder(parentId: string, token: string, name: string) {
  const params = new URLSearchParams({
    q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and name='${escapeDriveQuery(name)}'`,
    fields: "files(id,name,webViewLink)",
    pageSize: "1",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.error?.message || "Failed to find Drive archive folder",
    );
  return data.files?.[0] || null;
}

async function createChildFolder(
  parentId: string,
  token: string,
  name: string,
) {
  const params = new URLSearchParams({
    fields: "id,name,webViewLink",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.error?.message || "Failed to create Drive archive folder",
    );
  return data;
}

async function ensureChildFolder(
  parentId: string,
  token: string,
  name: string,
) {
  return (
    (await findChildFolder(parentId, token, name)) ||
    (await createChildFolder(parentId, token, name))
  );
}

async function ensureFolderPath(
  parentId: string,
  token: string,
  path: string[],
) {
  let folder = {
    id: parentId,
    name: "",
    webViewLink: undefined as string | undefined,
  };
  for (const part of path
    .map((item) => safeDriveFolderName(item, "Source folder"))
    .filter(Boolean)) {
    folder = await ensureChildFolder(folder.id, token, part);
  }
  return folder;
}

async function renameDriveFile(
  fileId: string,
  token: string,
  name: string,
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const params = new URLSearchParams({
    fields: "id,name,webViewLink",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Could not rename Drive folder");
  return data;
}

async function getDriveFolderWithParents(
  folderId: string,
  token: string,
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
}> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,parents,webViewLink",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Could not read Drive folder");
  return data;
}

async function restoreDriveItemAndParents(
  fileId: string,
  token: string,
  depth = 0,
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  trashed?: boolean;
}> {
  if (!fileId || fileId === "root" || depth > 8)
    throw new Error("Could not restore Drive item from trash");
  const params = new URLSearchParams({
    fields: "id,name,mimeType,parents,webViewLink,trashed",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Could not read Drive item");

  const parents = Array.isArray(data.parents)
    ? data.parents.filter(Boolean)
    : [];
  for (const parentId of parents) {
    if (parentId && parentId !== "root") {
      await restoreDriveItemAndParents(parentId, token, depth + 1).catch(
        (error) => {
          console.warn("[Drive restore parent]", {
            fileId,
            parentId,
            error: error instanceof Error ? error.message : error,
          });
        },
      );
    }
  }

  if (data.trashed === true) {
    const restoreParams = new URLSearchParams({
      fields: "id,name,mimeType,parents,webViewLink,trashed",
      supportsAllDrives: "true",
    });
    const restoreRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${restoreParams}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ trashed: false }),
      },
    );
    const restored = await restoreRes.json();
    if (!restoreRes.ok)
      throw new Error(
        restored.error?.message || "Could not restore Drive item from trash",
      );
    return restored;
  }

  return data;
}

type CreativeOsDriveSourceHealthInput = {
  id?: string;
  name?: string;
  driveFileId?: string;
  backendFolderId?: string;
  assetUrl?: string;
  backendFolderUrl?: string;
};

async function readDriveItemHealth(
  token: string,
  itemId: string,
  label: string,
) {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,trashed,webViewLink",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(itemId)}?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      reason:
        data?.error?.message || `${label} is not readable in Google Drive`,
    };
  }
  if (data?.trashed === true) {
    return {
      ok: false,
      reason: `${label} is in the owner's trash`,
    };
  }
  return { ok: true, reason: "" };
}

export async function checkCreativeOsDriveSourceAvailability(
  tenantId: string,
  sources: CreativeOsDriveSourceHealthInput[],
) {
  const token = await getAccessToken(tenantId);
  const uniqueSources = Array.from(
    new Map(
      sources.map((source, index) => [
        String(
          source.id ||
            source.driveFileId ||
            source.assetUrl ||
            source.name ||
            index,
        ),
        source,
      ]),
    ).values(),
  );

  const results = [];
  for (const source of uniqueSources) {
    const sourceName = String(source.name || "Source material");
    const fileId = String(
      source.driveFileId ||
        extractDriveFileId(String(source.assetUrl || "")) ||
        "",
    ).trim();
    const folderId = String(
      source.backendFolderId ||
        extractDriveFolderId(String(source.backendFolderUrl || "")) ||
        "",
    ).trim();
    const issues: string[] = [];

    if (folderId) {
      const folderHealth = await readDriveItemHealth(
        token,
        folderId,
        "Backend source folder",
      );
      if (!folderHealth.ok) issues.push(folderHealth.reason);
    }

    if (fileId) {
      const fileHealth = await readDriveItemHealth(
        token,
        fileId,
        "Source file",
      );
      if (!fileHealth.ok) issues.push(fileHealth.reason);
    }

    results.push({
      id: String(source.id || fileId || folderId || ""),
      name: sourceName,
      available: issues.length === 0,
      issues,
    });
  }

  return {
    ok: results.every((result) => result.available),
    results,
    unavailable: results.filter((result) => !result.available),
  };
}

function isMediaFile(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

function mediaTypeFromMime(mimeType: string): "image" | "video" {
  return mimeType.startsWith("video/") ? "video" : "image";
}

function driveImportSafeName(value: string, fallback: string) {
  return (
    String(value || fallback)
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^\w.\- ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) || fallback
  );
}

function tagsFromDrivePath(path: string | undefined) {
  return String(path || "")
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function downloadDriveMediaFile(
  file: { id: string; name: string },
  token: string,
) {
  const params = new URLSearchParams({
    alt: "media",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message || `Could not download ${file.name}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

function safeDriveFolderName(value: string, fallback: string) {
  return (
    String(value || fallback)
      .replace(/[\\/:*?"<>|#%{}[\]^~`]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) || fallback
  );
}

async function countNonFolderFilesRecursive(
  folderId: string,
  token: string,
): Promise<number> {
  let total = 0;
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,mimeType)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data.error?.message || "Could not count Drive folder files",
      );

    for (const file of data.files || []) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        total += await countNonFolderFilesRecursive(file.id, token);
      } else {
        total += 1;
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return total;
}

async function trashDriveFile(fileId: string, token: string) {
  const params = new URLSearchParams({
    fields: "id,name,trashed",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Could not trash Drive folder");
  return data as { id: string; name: string; trashed?: boolean };
}

async function folderFromId(folderId: string, token: string) {
  const folder = await getDriveFolderWithParents(folderId, token);
  if (folder.mimeType !== "application/vnd.google-apps.folder")
    throw new Error("Stored Drive id is not a folder");
  return folder;
}

async function productFolderFromReadyFolder(
  readyFolderId: string,
  token: string,
) {
  let folder = await folderFromId(readyFolderId, token);
  for (let depth = 0; depth < 10; depth += 1) {
    if (["Ready to edit", "Ready to use"].includes(folder.name)) {
      const productFolderId = Array.isArray(folder.parents)
        ? String(folder.parents[0] || "")
        : "";
      return productFolderId ? folderFromId(productFolderId, token) : null;
    }
    const parentId = Array.isArray(folder.parents)
      ? String(folder.parents[0] || "")
      : "";
    if (!parentId) break;
    folder = await folderFromId(parentId, token);
  }
  return null;
}

async function ensureCreativeOsDriveStructureWithToken(
  token: string,
  productName: string,
  options: CreativeOsDriveStructureOptions = {},
): Promise<CreativeOsDriveStructure> {
  const rootFolder =
    (await findChildFolder("root", token, "Ainomiq Creative OS")) ||
    (await createChildFolder("root", token, "Ainomiq Creative OS"));
  const existingProductFolder = options.productFolderId
    ? await folderFromId(options.productFolderId, token).catch(() => null)
    : null;
  const productFolderFromReady =
    !existingProductFolder && options.readyFolderId
      ? await productFolderFromReadyFolder(options.readyFolderId, token).catch(
          () => null,
        )
      : null;
  const productFolder =
    existingProductFolder ||
    productFolderFromReady ||
    (await ensureChildFolder(
      rootFolder.id,
      token,
      safeDriveFolderName(productName, "Creative Sources"),
    ));
  const readyFolder =
    (await findChildFolder(productFolder.id, token, "Ready to edit")) ||
    (await (async () => {
      const legacyReadyFolder = await findChildFolder(
        productFolder.id,
        token,
        "Ready to use",
      );
      return legacyReadyFolder
        ? renameDriveFile(legacyReadyFolder.id, token, "Ready to edit")
        : createChildFolder(productFolder.id, token, "Ready to edit");
    })());
  const photoFolder = await ensureChildFolder(readyFolder.id, token, "Photos");
  const videoFolder = await ensureChildFolder(readyFolder.id, token, "Videos");
  const usedFolder = await ensureChildFolder(productFolder.id, token, "Used");
  const usedPhotoFolder = await ensureChildFolder(
    usedFolder.id,
    token,
    "Photos",
  );
  const usedVideoFolder = await ensureChildFolder(
    usedFolder.id,
    token,
    "Videos",
  );

  return {
    rootFolderId: rootFolder.id,
    rootFolderUrl:
      rootFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${rootFolder.id}`,
    productFolderId: productFolder.id,
    productFolderUrl:
      productFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${productFolder.id}`,
    readyFolderId: readyFolder.id,
    readyFolderUrl:
      readyFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${readyFolder.id}`,
    photoFolderId: photoFolder.id,
    photoFolderUrl:
      photoFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${photoFolder.id}`,
    videoFolderId: videoFolder.id,
    videoFolderUrl:
      videoFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${videoFolder.id}`,
    usedFolderId: usedFolder.id,
    usedFolderUrl:
      usedFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${usedFolder.id}`,
    usedPhotoFolderId: usedPhotoFolder.id,
    usedPhotoFolderUrl:
      usedPhotoFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${usedPhotoFolder.id}`,
    usedVideoFolderId: usedVideoFolder.id,
    usedVideoFolderUrl:
      usedVideoFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${usedVideoFolder.id}`,
  };
}

export async function ensureCreativeOsProductDriveStructure(
  tenantId: string,
  productName: string,
  options: CreativeOsDriveStructureOptions = {},
): Promise<CreativeOsDriveStructure> {
  const token = await getAccessToken(tenantId);
  return ensureCreativeOsDriveStructureWithToken(token, productName, options);
}

export async function cleanupCreativeOsEmptyProductFolders(
  tenantId: string,
  keep: {
    productFolderIds?: string[];
    readyFolderIds?: string[];
    productNames?: string[];
  } = {},
): Promise<{
  trashed: Array<{ id: string; name: string }>;
  kept: Array<{ id: string; name: string; reason: string }>;
}> {
  const token = await getAccessToken(tenantId);
  const rootFolder = await findChildFolder(
    "root",
    token,
    "Ainomiq Creative OS",
  );
  if (!rootFolder) return { trashed: [], kept: [] };

  const keepIds = new Set(
    (keep.productFolderIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const keepNames = new Set(
    (keep.productNames || [])
      .map((name) =>
        normalizeName(safeDriveFolderName(name, "Creative Sources")),
      )
      .filter(Boolean),
  );
  for (const readyFolderId of keep.readyFolderIds || []) {
    const parent = await productFolderFromReadyFolder(
      String(readyFolderId || "").trim(),
      token,
    ).catch(() => null);
    if (parent?.id) keepIds.add(parent.id);
  }

  const productFolders = await listFolders(rootFolder.id, token);
  const trashed: Array<{ id: string; name: string }> = [];
  const kept: Array<{ id: string; name: string; reason: string }> = [];

  for (const folder of productFolders.slice(0, 200)) {
    if (keepIds.has(folder.id)) {
      kept.push({ id: folder.id, name: folder.name, reason: "referenced" });
      continue;
    }
    if (keepNames.has(normalizeName(folder.name))) {
      kept.push({
        id: folder.id,
        name: folder.name,
        reason: "current product name",
      });
      continue;
    }
    const fileCount = await countNonFolderFilesRecursive(
      folder.id,
      token,
    ).catch(() => -1);
    if (fileCount === 0) {
      await trashDriveFile(folder.id, token);
      trashed.push({ id: folder.id, name: folder.name });
    } else {
      kept.push({
        id: folder.id,
        name: folder.name,
        reason: `${fileCount} file${fileCount === 1 ? "" : "s"}`,
      });
    }
  }

  return { trashed, kept };
}

export async function shareDriveFoldersWithEmail(
  tenantId: string,
  folderIds: string[],
  email: string,
  role: "reader" | "writer" = "reader",
): Promise<{
  shared: string[];
  failed: Array<{ folderId: string; error: string }>;
}> {
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  const uniqueFolderIds = [
    ...new Set(folderIds.map((id) => String(id || "").trim()).filter(Boolean)),
  ];
  if (!cleanEmail || !uniqueFolderIds.length) return { shared: [], failed: [] };

  const token = await getAccessToken(tenantId);
  const shared: string[] = [];
  const failed: Array<{ folderId: string; error: string }> = [];

  for (const folderId of uniqueFolderIds) {
    try {
      await restoreDriveItemAndParents(folderId, token);
      const params = new URLSearchParams({
        supportsAllDrives: "true",
        sendNotificationEmail: "false",
      });
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}/permissions?${params}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            type: "user",
            role,
            emailAddress: cleanEmail,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          data?.error?.message || `Could not share Drive folder ${folderId}`;
        const alreadyShared = /already exists|duplicate/i.test(message);
        if (!alreadyShared) throw new Error(message);
      }
      shared.push(folderId);
    } catch (error) {
      failed.push({
        folderId,
        error:
          error instanceof Error
            ? error.message
            : "Could not share Drive folder",
      });
    }
  }

  return { shared, failed };
}

export async function revokeDriveFolderAccessForEmail(
  tenantId: string,
  folderIds: string[],
  email: string,
): Promise<{
  revoked: string[];
  failed: Array<{ folderId: string; error: string }>;
}> {
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  const uniqueFolderIds = [
    ...new Set(folderIds.map((id) => String(id || "").trim()).filter(Boolean)),
  ];
  if (!cleanEmail || !uniqueFolderIds.length)
    return { revoked: [], failed: [] };

  const token = await getAccessToken(tenantId);
  const revoked: string[] = [];
  const failed: Array<{ folderId: string; error: string }> = [];

  for (const folderId of uniqueFolderIds) {
    try {
      const listParams = new URLSearchParams({
        fields: "permissions(id,type,emailAddress,role)",
        supportsAllDrives: "true",
      });
      const listRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}/permissions?${listParams}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const listData = await listRes.json().catch(() => null);
      if (!listRes.ok)
        throw new Error(
          listData?.error?.message ||
            `Could not inspect Drive permissions for ${folderId}`,
        );

      const permissionIds = Array.isArray(listData?.permissions)
        ? listData.permissions
            .filter(
              (permission: any) =>
                String(permission?.type || "") === "user" &&
                String(permission?.emailAddress || "").toLowerCase() ===
                  cleanEmail,
            )
            .map((permission: any) => String(permission?.id || "").trim())
            .filter(Boolean)
        : [];

      if (!permissionIds.length) {
        revoked.push(folderId);
        continue;
      }

      for (const permissionId of permissionIds) {
        const deleteParams = new URLSearchParams({ supportsAllDrives: "true" });
        const deleteRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}/permissions/${encodeURIComponent(permissionId)}?${deleteParams}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!deleteRes.ok && deleteRes.status !== 404) {
          const deleteData = await deleteRes.json().catch(() => null);
          throw new Error(
            deleteData?.error?.message ||
              `Could not revoke Drive permission for ${folderId}`,
          );
        }
      }
      revoked.push(folderId);
    } catch (error) {
      failed.push({
        folderId,
        error:
          error instanceof Error
            ? error.message
            : "Could not revoke Drive access",
      });
    }
  }

  return { revoked, failed };
}

async function getDriveFileMetadata(
  fileId: string,
  token: string,
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  size?: string;
}> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,webViewLink,thumbnailLink,size",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Could not read Drive file");
  return data;
}

type DriveMediaFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  size?: string;
  importName?: string;
  importUrl?: string;
  importSourceUrl?: string;
  sourceFolderName?: string;
  sourceFolderUrl?: string;
  sourceFolderPath?: string;
};

async function listMediaFilesRecursive(
  folder: { id: string; name: string; webViewLink?: string },
  token: string,
  maxFiles = 100,
): Promise<DriveMediaFile[]> {
  const files: DriveMediaFile[] = [];
  const queue: Array<{
    id: string;
    name: string;
    path: string[];
    webViewLink?: string;
  }> = [
    {
      id: folder.id,
      name: folder.name || "Drive folder",
      path: [folder.name || "Drive folder"],
      webViewLink: folder.webViewLink,
    },
  ];
  while (queue.length && files.length < maxFiles) {
    const currentFolder = queue.shift()!;
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `'${currentFolder.id}' in parents and trashed=false`,
        fields:
          "nextPageToken,files(id,name,mimeType,webViewLink,thumbnailLink,size)",
        pageSize: "1000",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error?.message || "Could not list Drive folder files",
        );
      for (const file of data.files || []) {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          queue.push({
            id: file.id,
            name: file.name || "Drive folder",
            path: [...currentFolder.path, file.name || "Drive folder"],
            webViewLink: file.webViewLink,
          });
        } else if (isMediaFile(String(file.mimeType || ""))) {
          files.push({
            ...file,
            sourceFolderName: currentFolder.name,
            sourceFolderUrl: currentFolder.webViewLink,
            sourceFolderPath: currentFolder.path.join(" / "),
          });
          if (files.length >= maxFiles) break;
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken && files.length < maxFiles);
  }
  return files;
}

async function copyDriveFileToFolder(
  file: {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    thumbnailLink?: string;
  },
  token: string,
  destinationFolderId: string,
) {
  const existing = await findExistingCreativeOsCopy(
    destinationFolderId,
    token,
    file.id,
    file.name,
  );
  if (existing) return existing;

  const params = new URLSearchParams({
    fields: "id,name,mimeType,webViewLink,thumbnailLink",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/copy?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: file.name,
        parents: [destinationFolderId],
        appProperties: {
          creativeOsOriginalFileId: file.id,
          creativeOsImported: "true",
        },
      }),
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || `Could not copy ${file.name}`);
  return data as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    thumbnailLink?: string;
  };
}

async function moveExistingCreativeOsCopyToFolder(
  copiedFileId: string,
  token: string,
  destinationFolderId: string,
) {
  const file = await restoreDriveItemAndParents(copiedFileId, token);
  const parents = Array.isArray(file.parents)
    ? file.parents.filter(Boolean)
    : [];
  if (!parents.includes(destinationFolderId)) {
    const params = new URLSearchParams({
      addParents: destinationFolderId,
      removeParents: parents.join(","),
      fields: "id,name,mimeType,webViewLink,thumbnailLink,parents",
      supportsAllDrives: "true",
    });
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(copiedFileId)}?${params}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const moved = await res.json();
    if (!res.ok)
      throw new Error(
        moved.error?.message ||
          `Could not move existing Drive source copy for ${file.name}`,
      );
    return moved as {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      thumbnailLink?: string;
    };
  }

  const params = new URLSearchParams({
    fields: "id,name,mimeType,webViewLink,thumbnailLink",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(copiedFileId)}?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.error?.message ||
        `Could not read existing Drive source copy for ${file.name}`,
    );
  return data as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    thumbnailLink?: string;
  };
}

async function findExistingCreativeOsCopy(
  destinationFolderId: string,
  token: string,
  originalFileId: string,
  fileName: string,
) {
  const params = new URLSearchParams({
    q: `'${destinationFolderId}' in parents and trashed=false and appProperties has { key='creativeOsOriginalFileId' and value='${escapeDriveQuery(originalFileId)}' }`,
    fields: "files(id,name,mimeType,webViewLink,thumbnailLink)",
    pageSize: "1",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.error?.message ||
        `Could not check existing Drive source copy for ${fileName}`,
    );
  const file = data.files?.[0];
  return file
    ? (file as {
        id: string;
        name: string;
        mimeType: string;
        webViewLink?: string;
        thumbnailLink?: string;
      })
    : null;
}

async function resolveUsedFolderForReadyTree(parentId: string, token: string) {
  const pathFromReady: string[] = [];
  let currentFolderId = parentId;

  for (let depth = 0; depth < 10; depth += 1) {
    const folder = await getDriveFolderWithParents(currentFolderId, token);
    if (["Ready to edit", "Ready to use"].includes(folder.name)) {
      const productFolderId = Array.isArray(folder.parents)
        ? String(folder.parents[0] || "")
        : "";
      if (!productFolderId) break;
      const usedRoot = await ensureChildFolder(productFolderId, token, "Used");
      return pathFromReady.length
        ? ensureFolderPath(usedRoot.id, token, pathFromReady.reverse())
        : usedRoot;
    }

    pathFromReady.push(folder.name);
    const nextParentId = Array.isArray(folder.parents)
      ? String(folder.parents[0] || "")
      : "";
    if (!nextParentId) break;
    currentFolderId = nextParentId;
  }

  return null;
}

export async function importCreativeOsDriveSources(
  tenantId: string,
  links: string[],
  options: {
    productName: string;
    maxFiles?: number;
    productFolderId?: string;
    readyFolderId?: string;
    knownCopies?: KnownCreativeOsDriveCopy[];
  },
): Promise<{
  rootFolderId: string;
  rootFolderUrl: string;
  structure: CreativeOsDriveStructure;
  imported: ImportedCreativeOsDriveSource[];
}> {
  const token = await getAccessToken(tenantId);
  const structure = await ensureCreativeOsDriveStructureWithToken(
    token,
    options.productName,
    {
      productFolderId: options.productFolderId,
      readyFolderId: options.readyFolderId,
    },
  );
  const photoFolder = {
    id: structure.photoFolderId,
    webViewLink: structure.photoFolderUrl,
  };
  const videoFolder = {
    id: structure.videoFolderId,
    webViewLink: structure.videoFolderUrl,
  };
  const maxFiles = Math.max(1, Math.min(Number(options.maxFiles) || 500, 500));
  const knownCopiesByOriginalId = new Map(
    (options.knownCopies || [])
      .map(
        (item) =>
          [
            String(item.originalFileId || "").trim(),
            String(item.copiedFileId || "").trim(),
          ] as const,
      )
      .filter(
        ([originalFileId, copiedFileId]) => originalFileId && copiedFileId,
      ),
  );
  const folderRootCache = new Map<
    string,
    { id: string; webViewLink?: string }
  >();
  const folderPathCache = new Map<
    string,
    { id: string; webViewLink?: string }
  >();

  const sourceFiles: Array<{
    id: string;
    name: string;
    importName: string;
    importUrl?: string;
    importSourceUrl?: string;
    sourceFolderPath?: string;
    mimeType: string;
    webViewLink?: string;
    thumbnailLink?: string;
  }> = [];
  for (const link of links) {
    if (sourceFiles.length >= maxFiles) break;
    const fileId = extractDriveFileId(link);
    const folderId = extractDriveFolderId(link);
    if (fileId) {
      const file = await getDriveFileMetadata(fileId, token);
      if (!isMediaFile(file.mimeType)) continue;
      sourceFiles.push({
        ...file,
        importName: file.name || "Drive file",
        importUrl: file.webViewLink || link,
        importSourceUrl: link,
      });
      continue;
    }
    if (folderId) {
      const folder = await getDriveFileMetadata(folderId, token);
      const files = await listMediaFilesRecursive(
        folder,
        token,
        maxFiles - sourceFiles.length,
      );
      sourceFiles.push(
        ...files.map((file) => ({
          ...file,
          importName: folder.name || "Drive folder",
          importUrl: folder.webViewLink || link,
          importSourceUrl: link,
          sourceFolderPath: file.sourceFolderPath,
        })),
      );
      continue;
    }
    throw new Error("Paste Google Drive file or folder links.");
  }

  const deduped = Array.from(
    new Map(sourceFiles.map((file) => [file.id, file])).values(),
  ).slice(0, maxFiles);
  if (!deduped.length)
    throw new Error(
      "No image or video files found in the provided Drive links.",
    );

  const imported: ImportedCreativeOsDriveSource[] = [];
  for (const file of deduped) {
    const type = mediaTypeFromMime(file.mimeType);
    const pathParts = String(file.sourceFolderPath || "")
      .split(" / ")
      .map((part) => part.trim())
      .filter(Boolean);
    let destinationFolder: { id: string; webViewLink?: string } =
      type === "video" ? videoFolder : photoFolder;
    let backendFolder: { id: string; webViewLink?: string } = destinationFolder;

    if (pathParts.length) {
      const rootPathKey = pathParts[0];
      const fullPathKey = pathParts.join(" / ");
      backendFolder =
        folderRootCache.get(rootPathKey) ||
        (await ensureFolderPath(structure.readyFolderId, token, [rootPathKey]));
      folderRootCache.set(rootPathKey, backendFolder);
      destinationFolder =
        folderPathCache.get(fullPathKey) ||
        (await ensureFolderPath(structure.readyFolderId, token, pathParts));
      folderPathCache.set(fullPathKey, destinationFolder);
    }

    const knownCopiedFileId = knownCopiesByOriginalId.get(file.id);
    const copied = knownCopiedFileId
      ? await moveExistingCreativeOsCopyToFolder(
          knownCopiedFileId,
          token,
          destinationFolder.id,
        ).catch(() => copyDriveFileToFolder(file, token, destinationFolder.id))
      : await copyDriveFileToFolder(file, token, destinationFolder.id);
    imported.push({
      originalFileId: file.id,
      copiedFileId: copied.id,
      name: copied.name || file.name,
      importName: file.importName,
      importUrl: file.importUrl,
      importSourceUrl: file.importSourceUrl,
      sourceFolderPath: file.sourceFolderPath,
      mimeType: copied.mimeType || file.mimeType,
      type,
      originalUrl:
        file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      copiedUrl:
        copied.webViewLink ||
        `https://drive.google.com/file/d/${copied.id}/view`,
      thumbnailUrl: copied.thumbnailLink || file.thumbnailLink,
      backendFolderId: backendFolder.id,
      backendFolderUrl:
        backendFolder.webViewLink ||
        `https://drive.google.com/drive/folders/${backendFolder.id}`,
    });
  }

  return {
    rootFolderId: structure.rootFolderId,
    rootFolderUrl: structure.rootFolderUrl,
    structure,
    imported,
  };
}

export async function importDriveLinksToAinomiqLibrary(
  tenantId: string,
  links: string[],
  options: {
    productId?: string;
    productName: string;
    productUrl?: string;
    maxFiles?: number;
    actor?: string;
  },
): Promise<{ imported: ImportedDriveLibrarySource[]; skipped: number }> {
  const token = await getAccessToken(tenantId);
  const maxFiles = Math.max(1, Math.min(Number(options.maxFiles) || 500, 500));

  const sourceFiles: DriveMediaFile[] = [];
  for (const link of links) {
    if (sourceFiles.length >= maxFiles) break;
    const fileId = extractDriveFileId(link);
    const folderId = extractDriveFolderId(link);
    if (fileId) {
      const file = await getDriveFileMetadata(fileId, token);
      if (!isMediaFile(file.mimeType)) continue;
      sourceFiles.push({
        ...file,
        importName: file.name || "Drive file",
        importUrl: file.webViewLink || link,
        importSourceUrl: link,
      });
      continue;
    }
    if (folderId) {
      const folder = await getDriveFileMetadata(folderId, token);
      const files = await listMediaFilesRecursive(
        folder,
        token,
        maxFiles - sourceFiles.length,
      );
      sourceFiles.push(
        ...files.map((file) => ({
          ...file,
          importName: folder.name || "Drive folder",
          importUrl: folder.webViewLink || link,
          importSourceUrl: link,
        })),
      );
      continue;
    }
    throw new Error("Paste Google Drive file or folder links.");
  }

  const deduped = Array.from(
    new Map(sourceFiles.map((file) => [file.id, file])).values(),
  ).slice(0, maxFiles);
  if (!deduped.length)
    throw new Error(
      "No image or video files found in the provided Drive links.",
    );

  const imported: ImportedDriveLibrarySource[] = [];

  for (const file of deduped) {
    const type = mediaTypeFromMime(file.mimeType);
    const safeName = driveImportSafeName(
      file.name,
      type === "video" ? "drive-video.mp4" : "drive-image",
    );
    const body = await downloadDriveMediaFile(file, token);
    const plan = await uploadBufferToCreativeLibraryStorage({
      tenantId,
      fileName: safeName,
      contentType: file.mimeType,
      body,
    });

    const asset = await createCreativeLibraryAsset(tenantId, {
      name: file.name || plan.fileName,
      type,
      status: "ready",
      sourceType: "upload",
      assetUrl: plan.publicUrl,
      thumbnailUrl:
        type === "image" ? plan.publicUrl : file.thumbnailLink || null,
      fileName: plan.fileName,
      mimeType: plan.contentType,
      fileSize: Number(file.size || body.byteLength) || body.byteLength,
      ratio: "unknown",
      productId: options.productId || null,
      productName: options.productName,
      productUrl: options.productUrl || null,
      tags: [
        "creative-os-source",
        "drive-import",
        ...tagsFromDrivePath(file.sourceFolderPath),
      ],
      notes: file.sourceFolderPath
        ? `Imported from Drive path: ${file.sourceFolderPath}`
        : "Imported from Google Drive",
      landingPageUrl: file.webViewLink || file.importSourceUrl || null,
      actor: options.actor || tenantId,
    });
    const assetId = String(asset?.id || plan.assetId);
    imported.push({
      originalFileId: file.id,
      assetId,
      name: String(asset?.name || file.name || plan.fileName),
      importName: file.importName,
      importUrl: file.importUrl,
      importSourceUrl: file.importSourceUrl,
      sourceFolderPath: file.sourceFolderPath,
      mimeType: plan.contentType,
      fileSize: Number(file.size || body.byteLength) || body.byteLength,
      type,
      originalUrl:
        file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      assetUrl: plan.publicUrl,
      thumbnailUrl: type === "image" ? plan.publicUrl : file.thumbnailLink,
      backendFolderId: assetId,
      backendFolderUrl: plan.publicUrl,
    });
  }

  return { imported, skipped: deduped.length - imported.length };
}

export async function moveDriveFileToUsedFolder(
  tenantId: string,
  fileUrlOrId: string,
): Promise<{
  fileId: string;
  name: string;
  webViewLink: string;
  usedFolderId: string;
}> {
  const fileId = extractDriveFileId(fileUrlOrId);
  if (!fileId)
    throw new Error(
      "Paste the exact Google Drive file link, not only the folder link.",
    );
  const token = await getAccessToken(tenantId);
  await restoreDriveItemAndParents(fileId, token);
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents,webViewLink`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const file = await fileRes.json();
  if (!fileRes.ok)
    throw new Error(file.error?.message || "Could not read Drive file");
  if (file.mimeType === "application/vnd.google-apps.folder")
    throw new Error(
      "Use the exact source video/photo file link, not a folder link.",
    );
  const parents = Array.isArray(file.parents)
    ? file.parents.filter(Boolean)
    : [];
  const parentId = parents[0];
  if (!parentId) throw new Error("Drive file has no readable parent folder");
  let usedFolder =
    (await resolveUsedFolderForReadyTree(parentId, token)) ||
    (await ensureChildFolder(parentId, token, "Used"));
  try {
    const mediaFolder = await getDriveFolderWithParents(parentId, token);
    const readyFolderId = Array.isArray(mediaFolder.parents)
      ? mediaFolder.parents[0]
      : "";
    const mediaFolderName = ["Photos", "Videos"].includes(mediaFolder.name)
      ? mediaFolder.name
      : "";
    if (readyFolderId && mediaFolderName) {
      const readyFolder = await getDriveFolderWithParents(readyFolderId, token);
      const productFolderId = Array.isArray(readyFolder.parents)
        ? readyFolder.parents[0]
        : "";
      if (
        productFolderId &&
        ["Ready to edit", "Ready to use"].includes(readyFolder.name)
      ) {
        const usedRoot = await ensureChildFolder(
          productFolderId,
          token,
          "Used",
        );
        usedFolder = await ensureChildFolder(
          usedRoot.id,
          token,
          mediaFolderName,
        );
      }
    }
  } catch (err) {
    console.error("[Drive Used folder resolution]", err);
  }
  const params = new URLSearchParams({
    addParents: usedFolder.id,
    removeParents: parents.join(","),
    fields: "id,name,webViewLink,parents",
  });
  const moveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const moved = await moveRes.json();
  if (!moveRes.ok)
    throw new Error(moved.error?.message || "Could not move Drive file");
  return {
    fileId,
    name: String(moved.name || file.name || "Drive file"),
    webViewLink: String(
      moved.webViewLink ||
        file.webViewLink ||
        `https://drive.google.com/file/d/${fileId}/view`,
    ),
    usedFolderId: String(usedFolder.id),
  };
}

async function buildDriveProductFolders(
  token: string,
  newRootId: string,
  usedRootId = "",
): Promise<DriveProductFolder[]> {
  const [newFolders, usedFolders] = await Promise.all([
    listFolders(newRootId, token),
    usedRootId
      ? listFolders(usedRootId, token).catch(() => [])
      : Promise.resolve([]),
  ]);

  const usedByName = new Map(
    usedFolders.map((folder) => [normalizeName(folder.name), folder]),
  );
  const allNames = new Map<
    string,
    {
      name: string;
      newFolder?: { id: string; name: string; webViewLink?: string };
      usedFolder?: { id: string; name: string; webViewLink?: string };
    }
  >();

  for (const folder of newFolders) {
    allNames.set(normalizeName(folder.name), {
      name: folder.name,
      newFolder: folder,
      usedFolder: usedByName.get(normalizeName(folder.name)),
    });
  }
  for (const folder of usedFolders) {
    const key = normalizeName(folder.name);
    if (!allNames.has(key))
      allNames.set(key, { name: folder.name, usedFolder: folder });
  }

  const folders = await Promise.all(
    Array.from(allNames.values())
      .slice(0, 100)
      .map(async (folder) => {
        const productFolderId =
          folder.newFolder?.id || folder.usedFolder?.id || "";
        const childFolders = productFolderId
          ? await listFolders(productFolderId, token).catch(() => [])
          : [];
        const photoFolder = findMediaFolder(childFolders, "photo");
        const videoFolder = findMediaFolder(childFolders, "video");
        const [photoCounts, videoCounts, directNewCounts, usedCounts] =
          await Promise.all([
            photoFolder
              ? countFilesInFolder(photoFolder.id, token)
              : Promise.resolve({ images: 0, videos: 0 }),
            videoFolder
              ? countFilesInFolder(videoFolder.id, token)
              : Promise.resolve({ images: 0, videos: 0 }),
            folder.newFolder
              ? countFilesInFolder(folder.newFolder.id, token)
              : Promise.resolve({ images: 0, videos: 0 }),
            folder.usedFolder
              ? countFilesInFolder(folder.usedFolder.id, token)
              : Promise.resolve({ images: 0, videos: 0 }),
          ]);
        const linkedCounts =
          photoFolder || videoFolder
            ? {
                images: photoCounts.images + photoCounts.videos,
                videos: videoCounts.images + videoCounts.videos,
              }
            : directNewCounts;
        return {
          id: folder.newFolder?.id || folder.usedFolder?.id || folder.name,
          name: folder.name,
          url:
            folder.newFolder?.webViewLink ||
            folder.usedFolder?.webViewLink ||
            `https://drive.google.com/drive/folders/${productFolderId}`,
          photoFolderId: photoFolder?.id,
          photoFolderUrl: photoFolder?.webViewLink,
          videoFolderId: videoFolder?.id,
          videoFolderUrl: videoFolder?.webViewLink,
          new: {
            ...linkedCounts,
            total: linkedCounts.images + linkedCounts.videos,
          },
          used: { ...usedCounts, total: usedCounts.images + usedCounts.videos },
        };
      }),
  );

  folders.sort(
    (a, b) => b.new.total - a.new.total || a.name.localeCompare(b.name),
  );
  return folders;
}

export async function getDriveProductLibraryFromRoot(
  tenantId: string,
  rootUrlOrId: string,
): Promise<{
  rootId: string;
  rootUrl: string;
  totals: DriveContentCounts;
  folders: DriveProductFolder[];
}> {
  const rootId = extractDriveFolderId(rootUrlOrId);
  if (!rootId) throw new Error("Paste a valid Google Drive folder link");
  const token = await getAccessToken(tenantId);
  const rootCounts = await countFilesInFolder(rootId, token);
  const folders = await buildSmartDriveProductFolders(token, rootId);
  const totals: DriveContentCounts = {
    new: { ...rootCounts, total: rootCounts.images + rootCounts.videos },
    used: { images: 0, videos: 0, total: 0 },
  };
  return {
    rootId,
    rootUrl: `https://drive.google.com/drive/folders/${rootId}`,
    totals,
    folders,
  };
}

export async function getDriveProductLibrary(
  tenantId?: string,
): Promise<{ totals: DriveContentCounts; folders: DriveProductFolder[] }> {
  const token = await getAccessToken(tenantId);
  const [newCounts, usedCounts, newFolders, usedFolders] = await Promise.all([
    countFilesInFolder(DRIVE_FOLDERS.new.root, token),
    countFilesInFolder(DRIVE_FOLDERS.used.root, token),
    listFolders(DRIVE_FOLDERS.new.root, token),
    listFolders(DRIVE_FOLDERS.used.root, token),
  ]);

  const totals: DriveContentCounts = {
    new: { ...newCounts, total: newCounts.images + newCounts.videos },
    used: { ...usedCounts, total: usedCounts.images + usedCounts.videos },
  };

  const folders = await buildDriveProductFolders(
    token,
    DRIVE_FOLDERS.new.root,
    DRIVE_FOLDERS.used.root,
  );
  return { totals, folders };
}
