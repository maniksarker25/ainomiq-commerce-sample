import { getIntegration } from '@/lib/db';
import { isDemoTenant } from '@/lib/demo';
import { graphError, graphUrl, resolveFacebookPage } from '@/lib/cs-social';
import { fetchImageMetadata } from '@/lib/image-metadata';

export class ContentPublishError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = 'ContentPublishError';
    this.code = code;
    this.status = status;
  }
}

export type PublishResult = {
  mediaId?: string;
  postId?: string;
  permalink: string | null;
  demo?: boolean;
};

function getErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback;
  const record = data as { error?: { message?: string }; message?: string };
  return record.error?.message || record.message || fallback;
}

export function validatePublicHttpsImageUrl(imageUrl: string) {
  const trimmed = String(imageUrl || '').trim();
  if (!trimmed) {
    throw new ContentPublishError('Missing image URL.', 'MISSING_FIELD');
  }
  if (!/^https:\/\//i.test(trimmed)) {
    throw new ContentPublishError('Image URL must be a public HTTPS URL.', 'VALIDATION_ERROR');
  }
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
    throw new ContentPublishError(
      "Image URL cannot be hosted on localhost. Meta's servers must be able to publicly access the image.",
      'VALIDATION_ERROR',
    );
  }
  return trimmed;
}

export async function publishInstagramPost(
  tenantId: string,
  input: { imageUrl: string; caption: string },
): Promise<PublishResult> {
  const imageUrl = validatePublicHttpsImageUrl(input.imageUrl);
  const caption = String(input.caption || '').trim();
  if (!caption) {
    throw new ContentPublishError('Missing caption.', 'MISSING_FIELD');
  }

  if (isDemoTenant(tenantId)) {
    return {
      mediaId: `demo-media-${Date.now()}`,
      permalink: 'https://www.instagram.com/p/demo/',
      demo: true,
    };
  }

  // Preflight aspect ratio verification
  try {
    const meta = await fetchImageMetadata(imageUrl);
    if (meta.width > 0 && meta.height > 0) {
      const ratio = meta.width / meta.height;
      if (ratio < 0.8 || ratio > 1.91) {
        throw new ContentPublishError(
          `Instagram requires image aspect ratio to be between 4:5 (0.80) and 1.91:1 (1.91). Current image is ${meta.width}x${meta.height} (ratio: ${ratio.toFixed(2)}). Please crop or resize your image before posting.`,
          'VALIDATION_ERROR',
          400,
        );
      }
    }
  } catch (err) {
    if (err instanceof ContentPublishError) {
      throw err;
    }
    console.warn('[Content Studio Preflight] Warning: Could not verify aspect ratio:', err);
  }

  const integration = await getIntegration(tenantId, 'instagram');
  if (!integration?.access_token) {
    throw new ContentPublishError(
      'Instagram is not connected. Connect Meta in Content Studio settings first.',
      'INSTAGRAM_NOT_CONNECTED',
      400,
    );
  }

  const scopes = String(integration.scopes || '');
  const hasInstagramLoginPublish = scopes.includes('instagram_business_content_publish');
  const hasMetaPublish = scopes.includes('instagram_content_publish');
  if (!hasInstagramLoginPublish && !hasMetaPublish) {
    throw new ContentPublishError(
      'Instagram publish permission is missing. Reconnect Meta and allow content publishing.',
      'INSTAGRAM_PUBLISH_DENIED',
      403,
    );
  }

  const createParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: String(integration.access_token),
  });

  let igAccountId = String(integration.provider_account_id || 'me');
  if (igAccountId.includes('|')) {
    igAccountId = igAccountId.split('|')[1];
  }
  const graphBase = hasMetaPublish
    ? 'https://graph.facebook.com/v21.0'
    : 'https://graph.instagram.com/v21.0';
  const createUrl = hasMetaPublish ? `${graphBase}/${igAccountId}/media` : `${graphBase}/me/media`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createParams.toString(),
  });
  const createData = await createRes.json().catch(() => null);
  if (!createRes.ok || !createData?.id) {
    let errMsg = getErrorMessage(createData, 'Failed to create Instagram media container.');
    if (
      errMsg.toLowerCase().includes('media id is not available') ||
      errMsg.toLowerCase().includes('media id')
    ) {
      errMsg =
        "Media ID is not available. Meta could not download the image. Use a public HTTPS URL and an aspect ratio between 4:5 and 1.91:1.";
    }
    throw new ContentPublishError(errMsg, 'PUBLISH_FAILED', createRes.status || 500);
  }

  const publishParams = new URLSearchParams({
    creation_id: createData.id,
    access_token: String(integration.access_token),
  });

  const publishUrl = hasMetaPublish
    ? `${graphBase}/${igAccountId}/media_publish`
    : `${graphBase}/me/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: publishParams.toString(),
  });
  const publishData = await publishRes.json().catch(() => null);
  if (!publishRes.ok || !publishData?.id) {
    throw new ContentPublishError(
      getErrorMessage(publishData, 'Failed to publish to Instagram.'),
      'PUBLISH_FAILED',
      publishRes.status || 500,
    );
  }

  let permalink: string | null = null;
  const mediaRes = await fetch(
    `${graphBase}/${publishData.id}?fields=permalink&access_token=${encodeURIComponent(String(integration.access_token))}`,
  );
  if (mediaRes.ok) {
    const mediaData = await mediaRes.json().catch(() => null);
    permalink = mediaData?.permalink || null;
  }

  return {
    mediaId: publishData.id,
    permalink,
  };
}

export async function publishFacebookPost(
  tenantId: string,
  input: { imageUrl: string; caption: string; link?: string },
): Promise<PublishResult> {
  const imageUrl = validatePublicHttpsImageUrl(input.imageUrl);
  const caption = String(input.caption || '').trim();
  const link = String(input.link || '').trim();

  if (!caption && !imageUrl) {
    throw new ContentPublishError('Provide a caption and/or image URL.', 'MISSING_FIELD');
  }

  if (isDemoTenant(tenantId)) {
    return {
      postId: `demo-fb-${Date.now()}`,
      permalink: 'https://www.facebook.com/demo/posts/demo',
      demo: true,
    };
  }

  const page = await resolveFacebookPage(tenantId);
  if (!page?.accessToken || !page.pageId) {
    throw new ContentPublishError(
      'Facebook Page is not connected. Connect Meta posting from Settings first.',
      'VALIDATION_ERROR',
      400,
    );
  }

  let postId = '';
  let permalink: string | null = null;

  const params = new URLSearchParams({
    url: imageUrl,
    caption,
    access_token: page.accessToken,
  });
  if (link) params.set('link', link);

  const photoRes = await fetch(graphUrl(`${page.pageId}/photos`, {}), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });
  const photoData = await photoRes.json().catch(() => null);
  if (!photoRes.ok) {
    throw new ContentPublishError(
      graphError(photoData, 'Failed to publish photo to Facebook Page.'),
      'PUBLISH_FAILED',
      photoRes.status || 500,
    );
  }
  postId = String(photoData?.post_id || photoData?.id || '');
  permalink = photoData?.permalink_url ? String(photoData.permalink_url) : null;

  if (!postId) {
    throw new ContentPublishError('Facebook publish returned no post id.', 'PUBLISH_FAILED', 500);
  }

  return { postId, permalink };
}

export type PlannerPublishTarget = 'Instagram' | 'Facebook' | 'Instagram + Facebook';

export async function publishToPlannerPlatforms(
  tenantId: string,
  platform: PlannerPublishTarget,
  input: { imageUrl: string; caption: string },
): Promise<{ permalink: string | null; details: string[] }> {
  const details: string[] = [];
  let permalink: string | null = null;

  const targets: Array<'Instagram' | 'Facebook'> =
    platform === 'Instagram + Facebook' ? ['Instagram', 'Facebook'] : [platform];

  for (const target of targets) {
    if (target === 'Instagram') {
      const result = await publishInstagramPost(tenantId, input);
      if (result.permalink) permalink = result.permalink;
      details.push(result.permalink ? `Instagram: ${result.permalink}` : 'Instagram: published');
    } else {
      const result = await publishFacebookPost(tenantId, input);
      if (result.permalink) permalink = result.permalink;
      details.push(result.permalink ? `Facebook: ${result.permalink}` : 'Facebook: published');
    }
  }

  return { permalink, details };
}
