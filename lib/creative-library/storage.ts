import { createHash, createHmac, randomUUID } from 'crypto';

export type CreativeAssetKind = 'image' | 'video';
export type CreativeAssetVariant = 'original' | 'thumbnail' | 'preview';

export type CreativeAssetUploadPlan = {
  assetId: string;
  key: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
  type: CreativeAssetKind;
};

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

export type SupabaseStorageConfig = {
  url: string;
  serviceKey: string;
  bucket: string;
  publicBaseUrl: string;
  maxFileBytes: number;
};

type UploadPlanInput = {
  tenantId: string;
  fileName: string;
  contentType?: string | null;
  publicBaseUrl: string;
  assetId?: string;
};

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mov', 'mp4', 'mpeg', 'mpg', 'm4v', 'webm']);
const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  m4v: 'video/x-m4v',
  png: 'image/png',
  webm: 'video/webm',
  webp: 'image/webp',
};

function sanitizeSegment(value: string, fallback: string) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 140) || fallback;
}

export function sanitizeCreativeFileName(fileName: string) {
  const baseName = String(fileName || '').split(/[\\/]/).pop() || '';
  const sanitized = sanitizeSegment(baseName, 'asset');
  return sanitized.replace(/-+(\.[a-zA-Z0-9]+)$/g, '$1');
}

function extensionFor(fileName: string) {
  const match = sanitizeCreativeFileName(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function assetKindFor(fileName: string, contentType?: string | null): CreativeAssetKind {
  const cleanType = String(contentType || '').toLowerCase();
  if (cleanType.startsWith('video/')) return 'video';
  if (cleanType.startsWith('image/')) return 'image';
  const ext = extensionFor(fileName);
  return VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image';
}

function contentTypeFor(fileName: string, contentType?: string | null) {
  const cleanType = String(contentType || '').trim().toLowerCase();
  if (cleanType.includes('/') && !cleanType.includes('\n') && !cleanType.includes('\r')) return cleanType;
  return MIME_BY_EXTENSION[extensionFor(fileName)] || 'application/octet-stream';
}

export function buildCreativeAssetKey(input: {
  tenantId: string;
  assetId: string;
  fileName: string;
  variant: CreativeAssetVariant;
}) {
  const tenantSegment = sanitizeSegment(input.tenantId, 'tenant');
  const assetSegment = sanitizeSegment(input.assetId, 'asset');
  const fileSegment = sanitizeCreativeFileName(input.fileName);
  return `tenants/${tenantSegment}/creative-library/${assetSegment}/${input.variant}-${fileSegment}`;
}

export function createCreativeAssetUploadPlan(input: UploadPlanInput): CreativeAssetUploadPlan {
  const assetId = input.assetId || randomUUID();
  const fileName = sanitizeCreativeFileName(input.fileName);
  const contentType = contentTypeFor(fileName, input.contentType);
  const key = buildCreativeAssetKey({
    tenantId: input.tenantId,
    assetId,
    fileName,
    variant: 'original',
  });
  const publicBaseUrl = input.publicBaseUrl.replace(/\/+$/, '');
  return {
    assetId,
    key,
    fileName,
    contentType,
    type: assetKindFor(fileName, contentType),
    publicUrl: `${publicBaseUrl}/${key}`,
  };
}

export function getR2ConfigFromEnv(): R2Config {
  const config = {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.CLOUDFLARE_R2_BUCKET || process.env.CREATIVE_LIBRARY_R2_BUCKET || process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || '',
    publicBaseUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.CREATIVE_LIBRARY_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || '',
  };
  const missing = Object.entries(config).filter(([, value]) => !String(value || '').trim()).map(([key]) => key);
  if (missing.length) throw new Error(`Creative Library storage is not configured: ${missing.join(', ')}`);
  return config;
}

export function getSupabaseStorageConfigFromEnv(): SupabaseStorageConfig {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const bucket = (process.env.CREATIVE_LIBRARY_SUPABASE_BUCKET || 'creative-library').trim();
  const maxFileBytes = Math.max(1, Number(process.env.CREATIVE_LIBRARY_MAX_FILE_BYTES || 50 * 1024 * 1024));
  const publicBaseUrl = `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}`;
  const missing = [
    !url ? 'supabaseUrl' : '',
    !serviceKey ? 'supabaseServiceKey' : '',
    !bucket ? 'supabaseBucket' : '',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Creative Library storage is not configured: ${missing.join(', ')}`);
  return { url, serviceKey, bucket, publicBaseUrl, maxFileBytes };
}

export function getCreativeLibraryPublicBaseUrlFromEnv() {
  const r2PublicBaseUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.CREATIVE_LIBRARY_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || '').trim();
  if (r2PublicBaseUrl) return r2PublicBaseUrl;
  return getSupabaseStorageConfigFromEnv().publicBaseUrl;
}

function hasR2Config() {
  return Boolean(
    (process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID)
      && (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID)
      && (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY)
      && (process.env.CLOUDFLARE_R2_BUCKET || process.env.CREATIVE_LIBRARY_R2_BUCKET || process.env.R2_BUCKET_NAME || process.env.R2_BUCKET)
      && (process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.CREATIVE_LIBRARY_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL),
  );
}

export function getCreativeLibraryStorageProvider() {
  return hasR2Config() ? 'r2' : 'supabase';
}

export function getCreativeLibraryStorageStatus() {
  return {
    provider: getCreativeLibraryStorageProvider(),
    r2: {
      accountId: Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID),
      accessKeyId: Boolean(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID),
      secretAccessKey: Boolean(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY),
      bucket: Boolean(process.env.CLOUDFLARE_R2_BUCKET || process.env.CREATIVE_LIBRARY_R2_BUCKET || process.env.R2_BUCKET_NAME || process.env.R2_BUCKET),
      publicBaseUrl: Boolean(process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.CREATIVE_LIBRARY_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL),
    },
    supabase: {
      url: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      serviceKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      bucket: process.env.CREATIVE_LIBRARY_SUPABASE_BUCKET || 'creative-library',
      maxFileBytes: Number(process.env.CREATIVE_LIBRARY_MAX_FILE_BYTES || 50 * 1024 * 1024),
    },
  };
}

function supabaseHeaders(config: SupabaseStorageConfig, contentType = 'application/json') {
  return {
    apikey: config.serviceKey,
    authorization: `Bearer ${config.serviceKey}`,
    'content-type': contentType,
  };
}

function encodeStoragePath(path: string) {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

async function ensureSupabaseBucket(config: SupabaseStorageConfig) {
  const bucketUrl = `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`;
  const existing = await fetch(bucketUrl, { headers: supabaseHeaders(config), cache: 'no-store' });
  if (!existing.ok) {
    const existingText = await existing.text().catch(() => '');
    const bucketMissing = existing.status === 404 || /bucket not found/i.test(existingText);
    if (!bucketMissing) {
      throw new Error(`Could not inspect Creative Library bucket: ${existing.status} ${existingText.slice(0, 200)}`);
    }
    const created = await fetch(`${config.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: supabaseHeaders(config),
      body: JSON.stringify({
        id: config.bucket,
        name: config.bucket,
        public: true,
        file_size_limit: config.maxFileBytes,
      }),
    });
    if (!created.ok && created.status !== 409) {
      const text = await created.text().catch(() => '');
      throw new Error(`Could not create Creative Library bucket: ${created.status} ${text.slice(0, 200)}`);
    }
  }

  const updated = await fetch(bucketUrl, {
    method: 'PUT',
    headers: supabaseHeaders(config),
    body: JSON.stringify({
      public: true,
      file_size_limit: config.maxFileBytes,
    }),
  });
  if (!updated.ok) {
    const text = await updated.text().catch(() => '');
    throw new Error(`Could not configure Creative Library bucket: ${updated.status} ${text.slice(0, 200)}`);
  }
}

async function uploadBufferToSupabaseStorage(config: SupabaseStorageConfig, key: string, contentType: string, body: BodyInit) {
  await ensureSupabaseBucket(config);
  const res = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeStoragePath(key)}`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(config, contentType || 'application/octet-stream'),
      'x-upsert': 'true',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Could not upload to Creative Library storage: ${res.status} ${text.slice(0, 200)}`);
  }
}

export async function uploadBufferToCreativeLibraryStorage(input: {
  tenantId: string;
  fileName: string;
  contentType?: string | null;
  body: BodyInit;
  assetId?: string;
}) {
  if (hasR2Config()) {
    const config = getR2ConfigFromEnv();
    const plan = createCreativeAssetUploadPlan({
      tenantId: input.tenantId,
      fileName: input.fileName,
      contentType: input.contentType,
      publicBaseUrl: config.publicBaseUrl,
      assetId: input.assetId,
    });
    const uploadUrl = createR2PresignedPutUrl({ config, key: plan.key });
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': plan.contentType },
      body: input.body,
    });
    if (!uploadRes.ok) throw new Error(`Could not upload ${input.fileName} to the Ainomiq Library.`);
    console.info('[Creative Library Storage]', { provider: 'r2', key: plan.key, contentType: plan.contentType });
    return plan;
  }

  const config = getSupabaseStorageConfigFromEnv();
  const plan = createCreativeAssetUploadPlan({
    tenantId: input.tenantId,
    fileName: input.fileName,
    contentType: input.contentType,
    publicBaseUrl: config.publicBaseUrl,
    assetId: input.assetId,
  });
  await uploadBufferToSupabaseStorage(config, plan.key, plan.contentType, input.body);
  console.info('[Creative Library Storage]', { provider: 'supabase', key: plan.key, contentType: plan.contentType });
  return plan;
}

function hmac(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function hexHmac(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function signingKey(secret: string, dateStamp: string) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function encodePath(path: string) {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function createR2PresignedPutUrl(input: {
  config: R2Config;
  key: string;
  expiresInSeconds?: number;
  now?: Date;
}) {
  const expires = Math.min(Math.max(input.expiresInSeconds || 900, 60), 3600);
  const now = input.now || new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const host = `${input.config.accountId}.r2.cloudflarestorage.com`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const credential = `${input.config.accessKeyId}/${credentialScope}`;
  const canonicalUri = `/${encodeURIComponent(input.config.bucket)}/${encodePath(input.key)}`;
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  });
  query.sort();

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    query.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = hexHmac(signingKey(input.config.secretAccessKey, dateStamp), stringToSign);
  query.set('X-Amz-Signature', signature);

  return `https://${host}${canonicalUri}?${query.toString()}`;
}
