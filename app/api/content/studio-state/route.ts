import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getTenantConfig, setTenantConfig } from '@/lib/db';
import { isPersistableGeneratedImage, persistContentStudioImageUrl } from '@/lib/r2-media';
import { apiSuccess, badRequest, apiError, ErrorCode, withErrorHandler, handleStructuredAuthError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const STATE_KEY = 'content_studio_state';

// Hard cap on the serialized state to keep tenant_config rows reasonable. Base64
// image data URIs are stripped before serialization, so the payload is mostly
// JSON text (chat, drafts, templates, schedule). 1.5MB leaves plenty of room.
const MAX_STATE_BYTES = 1_500_000;
const MAX_CHAT = 60;
const MAX_DRAFTS = 30;
const MAX_TEMPLATES = 20;
const MAX_SCHEDULE = 60;

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function stripDataUris(value: Json): Json {
  if (Array.isArray(value)) return value.map((item) => stripDataUris(item as Json));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (
        (key === 'imageUrl' || key === 'image_url') &&
        typeof raw === 'string' &&
        raw.startsWith('data:')
      ) {
        next[key] = null;
      } else {
        next[key] = stripDataUris(raw as Json);
      }
    }
    return next;
  }
  return value;
}

function clampArray<T>(input: unknown, limit: number, keepEnd = false): T[] {
  if (!Array.isArray(input)) return [];
  return keepEnd ? (input.slice(-limit) as T[]) : (input.slice(0, limit) as T[]);
}

function isMenuKey(value: unknown): value is 'agent' | 'drafts' | 'feed' | 'settings' {
  return value === 'agent' || value === 'drafts' || value === 'feed' || value === 'settings';
}

async function persistDraftImagesInState(input: unknown, tenantId: string) {
  if (!input || typeof input !== 'object') return input;
  const source = input as Record<string, unknown>;
  if (!Array.isArray(source.drafts)) return input;

  const drafts = await Promise.all(
    source.drafts.map(async (raw) => {
      if (!raw || typeof raw !== 'object') return raw;
      const draft = raw as Record<string, unknown>;
      const url = draft.imageUrl ?? draft.image_url;
      if (typeof url !== 'string' || !isPersistableGeneratedImage(url)) return draft;
      const persisted = await persistContentStudioImageUrl(url, `content-studio/${tenantId}/drafts`);
      if (!persisted) return draft;
      return { ...draft, imageUrl: persisted, image_url: persisted };
    }),
  );

  return { ...source, drafts };
}

function sanitizeState(input: unknown) {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  const chat = clampArray<Record<string, unknown>>(source.chat, MAX_CHAT, true);
  const drafts = clampArray<Record<string, unknown>>(source.drafts, MAX_DRAFTS);
  const savedTemplates = clampArray<Record<string, unknown>>(source.savedTemplates, MAX_TEMPLATES);
  const scheduledPosts = clampArray<Record<string, unknown>>(source.scheduledPosts, MAX_SCHEDULE);

  const topicRaw = source.topic;
  const topic = typeof topicRaw === 'string' ? topicRaw.slice(0, 2000) : '';

  const productRaw = source.product;
  const product = typeof productRaw === 'string' ? productRaw.slice(0, 400) : '';

  const selectedModelRaw = source.selectedModel;
  const selectedModel = typeof selectedModelRaw === 'string' ? selectedModelRaw.slice(0, 120) : '';

  const selectedDraftIdRaw = source.selectedDraftId;
  const selectedDraftId = typeof selectedDraftIdRaw === 'string' ? selectedDraftIdRaw.slice(0, 200) : '';

  const weeklyPostCountRaw = Number(source.weeklyPostCount);
  const weeklyPostCount =
    Number.isFinite(weeklyPostCountRaw) && weeklyPostCountRaw >= 1 && weeklyPostCountRaw <= 30
      ? Math.floor(weeklyPostCountRaw)
      : 5;

  const activeMenu = isMenuKey(source.activeMenu) ? source.activeMenu : 'agent';

  return stripDataUris({
    chat,
    drafts,
    savedTemplates,
    scheduledPosts,
    topic,
    product,
    selectedModel,
    selectedDraftId,
    weeklyPostCount,
    activeMenu,
  }) as Record<string, unknown>;
}

function ensureUnderSizeLimit(state: Record<string, unknown>) {
  let serialized = JSON.stringify(state);
  if (serialized.length <= MAX_STATE_BYTES) return { state, serialized };

  const trimmed = { ...state };
  if (Array.isArray(trimmed.drafts) && trimmed.drafts.length > 10) {
    trimmed.drafts = trimmed.drafts.slice(0, 10);
    serialized = JSON.stringify(trimmed);
    if (serialized.length <= MAX_STATE_BYTES) return { state: trimmed, serialized };
  }
  if (Array.isArray(trimmed.scheduledPosts) && trimmed.scheduledPosts.length > 20) {
    trimmed.scheduledPosts = trimmed.scheduledPosts.slice(0, 20);
    serialized = JSON.stringify(trimmed);
    if (serialized.length <= MAX_STATE_BYTES) return { state: trimmed, serialized };
  }
  if (Array.isArray(trimmed.chat) && trimmed.chat.length > 20) {
    trimmed.chat = trimmed.chat.slice(-20);
    serialized = JSON.stringify(trimmed);
    if (serialized.length <= MAX_STATE_BYTES) return { state: trimmed, serialized };
  }
  return { state: trimmed, serialized };
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  let tenantId = '';
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleStructuredAuthError(err);
  }
  const raw = await getTenantConfig(tenantId, STATE_KEY);
  if (!raw) return apiSuccess({ state: null });
  try {
    return apiSuccess({ state: JSON.parse(raw) });
  } catch {
    return apiSuccess({ state: null });
  }
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.', ErrorCode.INVALID_JSON);
  }

  let tenantId = '';
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleStructuredAuthError(err);
  }

  const withPersistedImages = await persistDraftImagesInState(body.state, tenantId);
  const sanitized = sanitizeState(withPersistedImages);
  const { state, serialized } = ensureUnderSizeLimit({
    ...sanitized,
    updated_at: new Date().toISOString(),
  });

  if (serialized.length > MAX_STATE_BYTES) {
    return apiError('Studio state too large. Try clearing old drafts or chat history.', ErrorCode.STATE_TOO_LARGE, 413);
  }

  await setTenantConfig(tenantId, STATE_KEY, serialized);
  return apiSuccess({ bytes: serialized.length, state });
});
