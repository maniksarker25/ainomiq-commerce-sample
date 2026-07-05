import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

type ParsedDataUri = {
  mimeType: string;
  buffer: Buffer;
  extension: string;
};

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

let client: S3Client | null = null;

function getR2Client() {
  if (!client) {
    const accountId = process.env.R2_ACCOUNT_ID!;
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('svg')) return 'svg';
  return 'png';
}

function parseDataUri(uri: string): ParsedDataUri | null {
  const match = uri.match(/^data:([^,]+),([\s\S]*)$/i);
  if (!match) return null;
  const meta = match[1];
  const payload = match[2];
  const mimeType = (meta.split(';')[0] || 'image/png').toLowerCase();
  const isBase64 = meta.includes('base64');
  const buffer = Buffer.from(payload, isBase64 ? 'base64' : 'utf8');
  if (!buffer.length) return null;
  return { mimeType, buffer, extension: extensionForMime(mimeType) };
}

export function isPersistableGeneratedImage(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('data:image/')) return false;
  return !url.startsWith('data:image/svg');
}

export async function persistContentStudioImageUrl(
  url: string | null | undefined,
  keyPrefix: string,
): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  if (!r2Configured()) {
    console.warn('[r2-media] R2 not configured; generated image will not persist across sync');
    return null;
  }

  let buffer: Buffer;
  let mimeType: string;
  let extension: string;

  if (url.startsWith('data:')) {
    if (!isPersistableGeneratedImage(url)) return null;
    const parsed = parseDataUri(url);
    if (!parsed) return null;
    buffer = parsed.buffer;
    mimeType = parsed.mimeType;
    extension = parsed.extension;
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    const isGenerated = url.includes('openai') || url.includes('oaidalleapiprodscus') || url.includes('google') || url.includes('generative');
    if (!isGenerated) {
      return url;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) return url;
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = response.headers.get('content-type') || 'image/png';
      extension = extensionForMime(mimeType);
    } catch (err) {
      console.error('[r2-media] Failed to fetch remote image for persistence:', err);
      return url;
    }
  } else {
    return url;
  }

  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  const safePrefix = keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, '_').slice(0, 120);
  const key = `${safePrefix}/${hash}.${extension}`;
  const bucket = process.env.R2_BUCKET_NAME!;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const base = process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, '');
  return `${base}/${key}`;
}

export async function persistAgentDraftImages<T extends { image_url?: string | null }>(
  drafts: T[],
  tenantId: string,
): Promise<T[]> {
  return Promise.all(
    drafts.map(async draft => {
      const imageUrl = draft.image_url;
      if (!isPersistableGeneratedImage(imageUrl)) return draft;
      const persisted = await persistContentStudioImageUrl(
        imageUrl,
        `content-studio/${tenantId}/drafts`,
      );
      return persisted ? { ...draft, image_url: persisted } : draft;
    }),
  );
}
