import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { db, getTenantConfig } from '@/lib/db';
import { COOKIE_NAME, verifyJwt } from '@/lib/jwt';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import {
  type CreativeOsPermission,
  ensureCreativeOsStores,
  getInvitesForTenant,
  inviteHistoryPermissions,
  mergeInvitePermissions,
  normalizeInviteStatus,
  sanitizeStoredPermissions,
} from '@/lib/creative-os-invites';
import { notifyCreativeOsStateChanges } from '@/lib/creative-os-notifications';

export const dynamic = 'force-dynamic';

type CreativeOsProduct = {
  id: string;
  name: string;
  url: string;
  imageUrl: string;
  explanation: string;
  sellingPoints: string[];
  pains: string[];
  personas: string[];
  claimBoundaries: string[];
  defaultDerivativeCap: number;
  platforms: string[];
  namingConvention: string;
  createdAt: string;
};

type CreativeOsState = {
  activeProductId: string;
  activeSection: string;
  brand: CreativeOsBrandProfile;
  products: CreativeOsProduct[];
  sources: CreativeOsSource[];
  tasks: CreativeOsTask[];
  deletedTaskIds?: string[];
  deletedSourceIds?: string[];
  deletedDeliveredEditIds?: string[];
  deletedReviewIds?: string[];
  deliveredEdits: CreativeOsDeliveredEdit[];
  reviews: CreativeOsReview[];
  launchItems: CreativeOsLaunchItem[];
  performance: CreativeOsPerformance[];
  permissions: CreativeOsPermission[];
  permissionHistory?: CreativeOsPermission[];
  chatMessages: CreativeOsChatMessage[];
};

type CreativeOsBrandProfile = {
  name: string;
  story: string;
  voice: string;
  instructions: string;
  doNotSay: string;
  referenceLinks: CreativeOsBrandReferenceLink[];
};

type CreativeOsBrandReferenceLink = {
  id: string;
  url: string;
  info: string;
};

type CreativeOsSource = {
  id?: unknown;
  productId?: unknown;
  status?: unknown;
  derivativeCount?: unknown;
  derivativeCap?: unknown;
  [key: string]: unknown;
};

type CreativeOsTask = {
  id?: unknown;
  productId?: unknown;
  sourceCreativeId?: unknown;
  outputCount?: unknown;
  status?: unknown;
  sourceUsageLocked?: unknown;
  [key: string]: unknown;
};

type CreativeOsDeliveredEdit = {
  id?: unknown;
  productId?: unknown;
  taskId?: unknown;
  [key: string]: unknown;
};

type CreativeOsReview = {
  id?: unknown;
  productId?: unknown;
  deliveredEditId?: unknown;
  [key: string]: unknown;
};

type CreativeOsLaunchItem = {
  id?: unknown;
  productId?: unknown;
  sourceCreativeId?: unknown;
  deliveredEditId?: unknown;
  [key: string]: unknown;
};

type CreativeOsPerformance = {
  launchItemId?: unknown;
  [key: string]: unknown;
};

type CreativeOsChatMessage = {
  id?: unknown;
  productId?: unknown;
  taskId?: unknown;
  roomId?: unknown;
  authorEmail?: unknown;
  authorName?: unknown;
  authorRole?: unknown;
  body?: unknown;
  createdAt?: unknown;
  [key: string]: unknown;
};

const STATE_KEY = 'creative_os_state_v1';

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function looksLikeEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function invalidSubmittedFinishedAd(savedState: CreativeOsState, incomingState: CreativeOsState) {
  const savedPreviewsById = new Map(savedState.deliveredEdits
    .map(edit => [idOf(edit), String(edit.previewUrl || '').trim()])
    .filter(([id]) => Boolean(id)) as Array<[string, string]>);
  return incomingState.deliveredEdits.find(edit => {
    const previewUrl = String(edit.previewUrl || '').trim();
    if (!previewUrl) return false;
    const editId = idOf(edit);
    if (editId && savedPreviewsById.get(editId) === previewUrl) return false;
    return !/^https?:\/\//i.test(previewUrl);
  });
}

function productIdOf(item: { productId?: unknown }) {
  return typeof item.productId === 'string' ? item.productId : '';
}

function emptyState(): CreativeOsState {
  return {
    activeProductId: '',
    activeSection: 'dashboard',
    brand: emptyBrandProfile(),
    products: [],
    sources: [],
    tasks: [],
    deletedTaskIds: [],
    deletedSourceIds: [],
    deletedDeliveredEditIds: [],
    deletedReviewIds: [],
    deliveredEdits: [],
    reviews: [],
    launchItems: [],
    performance: [],
    permissions: [],
    chatMessages: [],
  };
}

function emptyBrandProfile(): CreativeOsBrandProfile {
  return {
    name: '',
    story: '',
    voice: '',
    instructions: '',
    doNotSay: '',
    referenceLinks: [],
  };
}

function normalizeBrandProfile(value: unknown): CreativeOsBrandProfile {
  const candidate = value && typeof value === 'object' ? value as Partial<CreativeOsBrandProfile> : {};
  return {
    name: typeof candidate.name === 'string' ? candidate.name : '',
    story: typeof candidate.story === 'string' ? candidate.story : '',
    voice: typeof candidate.voice === 'string' ? candidate.voice : '',
    instructions: typeof candidate.instructions === 'string' ? candidate.instructions : '',
    doNotSay: typeof candidate.doNotSay === 'string' ? candidate.doNotSay : '',
    referenceLinks: normalizeBrandReferenceLinks(candidate.referenceLinks),
  };
}

function normalizeBrandReferenceLinks(input: unknown): CreativeOsBrandReferenceLink[] {
  const items = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/\n|,/).map(url => ({ url }))
      : [];
  return items
    .map((item, index) => {
      const candidate = item && typeof item === 'object' ? item as Partial<CreativeOsBrandReferenceLink> & { note?: string; description?: string } : {};
      const url = typeof candidate.url === 'string' ? candidate.url.trim().slice(0, 1000) : '';
      const info = typeof candidate.info === 'string'
        ? candidate.info.trim().slice(0, 1000)
        : typeof candidate.note === 'string'
          ? candidate.note.trim().slice(0, 1000)
          : typeof candidate.description === 'string'
            ? candidate.description.trim().slice(0, 1000)
            : '';
      const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim().slice(0, 120) : `brand-reference-${index}-${url.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) || 'link'}`;
      return { id, url, info };
    })
    .filter(item => item.url || item.info)
    .slice(0, 50);
}

function normalizeChatMessages(value: unknown): CreativeOsChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const candidate = item && typeof item === 'object' ? item as CreativeOsChatMessage : {};
      const roomId = typeof candidate.roomId === 'string' ? candidate.roomId.trim() : '';
      const taskId = typeof candidate.taskId === 'string' ? candidate.taskId.trim() : '';
      const body = typeof candidate.body === 'string' ? candidate.body.trim() : '';
      if (!roomId || !taskId || !body) return null;
      const normalized: CreativeOsChatMessage = {
        ...candidate,
        id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `chat-${Date.now()}-${index}`,
        productId: typeof candidate.productId === 'string' ? candidate.productId : '',
        taskId,
        roomId,
        authorEmail: typeof candidate.authorEmail === 'string' ? candidate.authorEmail : '',
        authorName: typeof candidate.authorName === 'string' ? candidate.authorName : '',
        authorRole: candidate.authorRole === 'editor' ? 'editor' : 'founder',
        body,
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
      };
      return normalized;
    })
    .filter((item): item is CreativeOsChatMessage => Boolean(item));
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeState(value: unknown): CreativeOsState {
  const fallback = emptyState();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<CreativeOsState>;
  const products = Array.isArray(candidate.products) ? candidate.products.filter(Boolean) as CreativeOsProduct[] : [];
  const permissions = Array.isArray(candidate.permissions)
    ? sanitizeStoredPermissions(candidate.permissions as CreativeOsPermission[])
    : [];
  return repairIncompleteMultiOutputTasks(applyDeletedReviewIds(applyDeletedSourceIds(applyDeletedTaskIds({
    activeProductId: typeof candidate.activeProductId === 'string' ? candidate.activeProductId : products[0]?.id || '',
    activeSection: typeof candidate.activeSection === 'string' ? candidate.activeSection : 'setup',
    brand: normalizeBrandProfile(candidate.brand),
    products,
    sources: Array.isArray(candidate.sources) ? candidate.sources.filter(Boolean) as CreativeOsSource[] : [],
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks.filter(Boolean) as CreativeOsTask[] : [],
    deletedTaskIds: uniqueStrings(Array.isArray(candidate.deletedTaskIds) ? candidate.deletedTaskIds : []),
    deletedSourceIds: uniqueStrings(Array.isArray(candidate.deletedSourceIds) ? candidate.deletedSourceIds : []),
    deletedDeliveredEditIds: uniqueStrings(Array.isArray(candidate.deletedDeliveredEditIds) ? candidate.deletedDeliveredEditIds : []),
    deletedReviewIds: uniqueStrings(Array.isArray(candidate.deletedReviewIds) ? candidate.deletedReviewIds : []),
    deliveredEdits: Array.isArray(candidate.deliveredEdits) ? candidate.deliveredEdits.filter(Boolean) as CreativeOsDeliveredEdit[] : [],
    reviews: Array.isArray(candidate.reviews) ? candidate.reviews.filter(Boolean) as CreativeOsReview[] : [],
    launchItems: Array.isArray(candidate.launchItems) ? candidate.launchItems.filter(Boolean) as CreativeOsLaunchItem[] : [],
    performance: Array.isArray(candidate.performance) ? candidate.performance.filter(Boolean) as CreativeOsPerformance[] : [],
    permissions,
    chatMessages: normalizeChatMessages(candidate.chatMessages),
  }))));
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map(value => typeof value === 'string' ? value.trim() : '').filter(Boolean))];
}

function sourceLegacyGroupKey(source: CreativeOsSource) {
  const importName = typeof source.importName === 'string' ? source.importName : '';
  const importUrl = typeof source.importUrl === 'string' ? source.importUrl : '';
  const uploadedAt = typeof source.uploadedAt === 'string' ? source.uploadedAt : '';
  if (importName) return `import:${importName}:${importUrl || uploadedAt.slice(0, 16)}`;
  return '';
}

function sourceGroupKey(source: CreativeOsSource) {
  const rootKey = sourceRootGroupKey(source);
  if (rootKey) return rootKey;
  const legacyKey = sourceLegacyGroupKey(source);
  if (legacyKey) return legacyKey;
  const creator = typeof source.creator === 'string' ? source.creator : '';
  const backendFolderUrl = typeof source.backendFolderUrl === 'string' ? source.backendFolderUrl : '';
  const productId = typeof source.productId === 'string' ? source.productId : '';
  const id = typeof source.id === 'string' ? source.id : '';
  if (creator === 'Catalog import') return `catalog:${productId}`;
  return `source:${id}`;
}

function sourceRootGroupName(source: CreativeOsSource) {
  const importName = typeof source.importName === 'string' ? source.importName.trim() : '';
  if (!importName.includes('/')) return '';
  return importName.split('/')[0]?.trim() || '';
}

function sourceRootGroupKey(source: CreativeOsSource) {
  const rootName = sourceRootGroupName(source);
  if (!rootName) return '';
  const uploadedAt = typeof source.uploadedAt === 'string' ? source.uploadedAt : '';
  const productId = typeof source.productId === 'string' ? source.productId : '';
  return `import-root:${productId}:${rootName}:${uploadedAt.slice(0, 16)}`;
}

function applyDeletedTaskIds(state: CreativeOsState, extraDeletedTaskIds: string[] = []): CreativeOsState {
  const deletedTaskIds = uniqueStrings([...(Array.isArray(state.deletedTaskIds) ? state.deletedTaskIds : []), ...extraDeletedTaskIds]);
  if (!deletedTaskIds.length) return { ...state, deletedTaskIds: [] };

  const deletedTaskIdSet = new Set(deletedTaskIds);
  const deletedEditIds = new Set(state.deliveredEdits.filter(edit => deletedTaskIdSet.has(String(edit.taskId || ''))).map(edit => String(edit.id || '')).filter(Boolean));
  const deletedLaunchIds = new Set(state.launchItems.filter(item => deletedEditIds.has(String(item.deliveredEditId || ''))).map(item => String(item.id || '')).filter(Boolean));
  const deletedRoomIds = new Set(state.tasks.filter(task => deletedTaskIdSet.has(String(task.id || ''))).map(taskRoomId).filter(Boolean));

  return {
    ...state,
    deletedTaskIds,
    tasks: state.tasks.filter(task => !deletedTaskIdSet.has(String(task.id || ''))),
    deliveredEdits: state.deliveredEdits.filter(edit => !deletedTaskIdSet.has(String(edit.taskId || ''))),
    reviews: state.reviews.filter(review => !deletedEditIds.has(String(review.deliveredEditId || ''))),
    launchItems: state.launchItems.filter(item => !deletedEditIds.has(String(item.deliveredEditId || ''))),
    performance: state.performance.filter(item => !deletedLaunchIds.has(String(item.launchItemId || ''))),
    chatMessages: state.chatMessages.filter(message => !deletedRoomIds.has(String(message.roomId || ''))),
  };
}

function applyDeletedSourceIds(state: CreativeOsState, extraDeletedSourceIds: string[] = []): CreativeOsState {
  const deletedSourceIds = uniqueStrings([...(Array.isArray(state.deletedSourceIds) ? state.deletedSourceIds : []), ...extraDeletedSourceIds]);
  if (!deletedSourceIds.length) return { ...state, deletedSourceIds: [] };

  const deletedSourceIdSet = new Set(deletedSourceIds);
  return {
    ...state,
    deletedSourceIds,
    sources: state.sources.filter(source => !deletedSourceIdSet.has(String(source.id || ''))),
  };
}

function applyDeletedReviewIds(state: CreativeOsState): CreativeOsState {
  const deletedDeliveredEditIds = uniqueStrings(Array.isArray(state.deletedDeliveredEditIds) ? state.deletedDeliveredEditIds : []);
  const deletedReviewIds = uniqueStrings(Array.isArray(state.deletedReviewIds) ? state.deletedReviewIds : []);
  if (!deletedDeliveredEditIds.length && !deletedReviewIds.length) return { ...state, deletedDeliveredEditIds: [], deletedReviewIds: [] };

  const deletedEditIdSet = new Set(deletedDeliveredEditIds);
  const deletedReviewIdSet = new Set(deletedReviewIds);
  return {
    ...state,
    deletedDeliveredEditIds,
    deletedReviewIds,
    deliveredEdits: state.deliveredEdits.filter(edit => !deletedEditIdSet.has(String(edit.id || ''))),
    reviews: state.reviews.filter(review => !deletedReviewIdSet.has(String(review.id || '')) && !deletedEditIdSet.has(String(review.deliveredEditId || ''))),
    launchItems: state.launchItems.filter(item => !deletedEditIdSet.has(String(item.deliveredEditId || ''))),
  };
}

function repairIncompleteMultiOutputTasks(state: CreativeOsState): CreativeOsState {
  const editTaskIdById = new Map<string, string>();
  state.deliveredEdits.forEach(edit => {
    const editId = String(edit.id || '');
    const taskId = String(edit.taskId || '');
    if (editId && taskId) editTaskIdById.set(editId, taskId);
  });
  const approvedCountByTaskId = new Map<string, number>();
  state.launchItems.forEach(launch => {
    const taskId = editTaskIdById.get(String(launch.deliveredEditId || ''));
    if (!taskId) return;
    approvedCountByTaskId.set(taskId, (approvedCountByTaskId.get(taskId) || 0) + 1);
  });
  return {
    ...state,
    tasks: state.tasks.map(task => {
      if (task.status !== 'delivered') return task;
      const taskId = idOf(task);
      const expectedOutputs = Math.max(1, Number(task.outputCount) || 1);
      const approvedCount = approvedCountByTaskId.get(taskId) || 0;
      return approvedCount < expectedOutputs ? { ...task, status: 'in progress' } : task;
    }),
  };
}

function applySourceLifecycle(state: CreativeOsState): CreativeOsState {
  const usageBySourceId = new Map<string, number>();
  const activeTaskSourceIds = new Set<string>();
  const activeTaskGroupKeys = new Set<string>();
  const activeTaskIdsBySourceId = new Map<string, string[]>();
  const activeTaskIdsByGroupKey = new Map<string, string[]>();

  state.tasks.forEach(task => {
    const sourceId = typeof task.sourceCreativeId === 'string' ? task.sourceCreativeId : '';
    const groupKey = typeof task.sourceGroupKey === 'string' ? task.sourceGroupKey : '';
    const taskId = typeof task.id === 'string' ? task.id : '';
    const status = typeof task.status === 'string' ? task.status : '';
    if (sourceId && sourceId !== 'ready-ad-link' && status !== 'archived') {
      activeTaskSourceIds.add(sourceId);
      if (taskId) activeTaskIdsBySourceId.set(sourceId, [...(activeTaskIdsBySourceId.get(sourceId) || []), taskId]);
    }
    if (groupKey && status !== 'archived') {
      activeTaskGroupKeys.add(groupKey);
      if (taskId) activeTaskIdsByGroupKey.set(groupKey, [...(activeTaskIdsByGroupKey.get(groupKey) || []), taskId]);
    }
  });

  state.launchItems.forEach(launch => {
    const sourceId = typeof launch.sourceCreativeId === 'string' ? launch.sourceCreativeId : '';
    if (!sourceId || sourceId === 'ready-ad-link') return;
    const editId = typeof launch.deliveredEditId === 'string' ? launch.deliveredEditId : '';
    const edit = state.deliveredEdits.find(item => item.id === editId);
    const taskId = typeof edit?.taskId === 'string' ? edit.taskId : '';
    const task = state.tasks.find(item => item.id === taskId);
    const outputCount = Math.max(1, Number(edit?.outputCount) || Number(task?.outputCount) || 1);
    usageBySourceId.set(sourceId, (usageBySourceId.get(sourceId) || 0) + outputCount);
  });

  state.tasks.forEach(task => {
    const sourceId = typeof task.sourceCreativeId === 'string' ? task.sourceCreativeId : '';
    if (!sourceId || sourceId === 'ready-ad-link') return;
    if (task.status !== 'archived' || task.sourceUsageLocked !== true) return;
    const outputCount = Math.max(1, Number(task.outputCount) || 1);
    usageBySourceId.set(sourceId, Math.max(usageBySourceId.get(sourceId) || 0, outputCount));
  });

  return {
    ...state,
    sources: state.sources.map(source => {
      const sourceId = typeof source.id === 'string' ? source.id : '';
      const groupKey = sourceGroupKey(source);
      const rootGroupKey = sourceRootGroupKey(source);
      const activeGroupTaskIds = uniqueStrings([
        ...(activeTaskIdsByGroupKey.get(groupKey) || []),
        ...(rootGroupKey ? activeTaskIdsByGroupKey.get(rootGroupKey) || [] : []),
      ]);
      const derivativeCount = sourceId ? usageBySourceId.get(sourceId) || 0 : Math.max(0, Number(source.derivativeCount) || 0);
      const derivativeCap = Math.max(1, Number(source.derivativeCap) || 5);
      const manualStatus = typeof source.status === 'string' ? source.status : '';
      const status = manualStatus === 'do not use'
        ? 'do not use'
        : derivativeCount >= derivativeCap
          ? 'maxed out'
          : derivativeCount > 0 || activeTaskSourceIds.has(sourceId) || activeTaskGroupKeys.has(groupKey) || (rootGroupKey ? activeTaskGroupKeys.has(rootGroupKey) : false)
            ? 'assigned'
            : 'available';

      return {
        ...source,
        derivativeCount,
        derivativeCap,
        status,
        assignedTaskIds: uniqueStrings([...(activeTaskIdsBySourceId.get(sourceId) || []), ...activeGroupTaskIds]),
      };
    }),
  };
}

function allowedEditorProductIds(invites: Awaited<ReturnType<typeof getInvitesForTenant>>, email: string) {
  const normalizedEmail = normalizeEmail(email);
  return new Set(invites
    .filter(invite => invite.status === 'accepted' && normalizeEmail(invite.email) === normalizedEmail)
    .map(invite => invite.productId)
    .filter(Boolean));
}

function editorProductIdsForState(invites: Awaited<ReturnType<typeof getInvitesForTenant>>, state: CreativeOsState, email: string) {
  const productIds = allowedEditorProductIds(invites, email);
  state.tasks
    .filter(task => taskAssignedToEmail(task, email))
    .map(productIdOf)
    .filter(Boolean)
    .forEach(productId => productIds.add(productId));
  return productIds;
}

function taskAssignedToEmail(task: CreativeOsTask, email: string) {
  return normalizeEmail(task.assignee) === normalizeEmail(email);
}

function idOf(item: { id?: unknown }) {
  return typeof item.id === 'string' ? item.id : '';
}

function sourceMatchesTask(source: CreativeOsSource, task: CreativeOsTask) {
  const sourceId = idOf(source);
  const taskSourceId = typeof task.sourceCreativeId === 'string' ? task.sourceCreativeId : '';
  const taskGroupKey = typeof task.sourceGroupKey === 'string' ? task.sourceGroupKey : '';
  if (sourceId && sourceId === taskSourceId) return true;
  if (!taskGroupKey) return false;
  return sourceGroupKey(source) === taskGroupKey || sourceRootGroupKey(source) === taskGroupKey || sourceLegacyGroupKey(source) === taskGroupKey;
}

function taskRoomId(task: CreativeOsTask) {
  return typeof task.chatRoomId === 'string' && task.chatRoomId ? task.chatRoomId : idOf(task);
}

function taskLegacyParticipantChatRoomId(task: CreativeOsTask) {
  const assignee = normalizeEmail(task.assignee);
  return assignee ? `editor:${assignee}` : taskRoomId(task);
}

function taskParticipantChatRoomId(task: CreativeOsTask) {
  const assignee = normalizeEmail(task.assignee);
  return assignee ? `editor:${productIdOf(task)}:${assignee}` : taskRoomId(task);
}

function filterStateForEditor(state: CreativeOsState, productIds: Set<string>, email: string): CreativeOsState {
  const products = state.products.filter(product => productIds.has(product.id));
  const tasks = state.tasks.filter(task => productIds.has(productIdOf(task)) && taskAssignedToEmail(task, email));
  const taskIds = new Set(tasks.map(idOf).filter(Boolean));
  const roomIds = new Set(tasks.flatMap(task => [taskRoomId(task), taskLegacyParticipantChatRoomId(task), taskParticipantChatRoomId(task)]).filter(Boolean));
  const deliveredEdits = state.deliveredEdits.filter(edit => productIds.has(productIdOf(edit)) && taskIds.has(String(edit.taskId || '')));
  const deliveredEditIds = new Set(deliveredEdits.map(idOf).filter(Boolean));
  const reviews = state.reviews.filter(review => deliveredEditIds.has(String(review.deliveredEditId || '')));
  const launchItems = state.launchItems.filter(item => deliveredEditIds.has(String(item.deliveredEditId || '')));
  const allowedLaunchIds = new Set(launchItems.map(idOf).filter(Boolean));
  const sources = state.sources.filter(source => productIds.has(productIdOf(source)) && tasks.some(task => sourceMatchesTask(source, task)));

  return {
    ...state,
    activeProductId: products.some(product => product.id === state.activeProductId) ? state.activeProductId : products[0]?.id || '',
    activeSection: 'setup',
    products,
    sources,
    tasks,
    deliveredEdits,
    reviews,
    launchItems,
    performance: state.performance.filter(item => allowedLaunchIds.has(String(item.launchItemId || ''))),
    chatMessages: state.chatMessages.filter(message => roomIds.has(String(message.roomId || ''))),
    permissions: [],
    permissionHistory: [],
  };
}

function mergeById<T extends { id?: unknown }>(base: T[], incoming: T[]) {
  const byId = new Map<string, T>();
  base.forEach(item => {
    const id = idOf(item);
    if (id) byId.set(id, item);
  });
  incoming.forEach(item => {
    const id = idOf(item);
    if (id) byId.set(id, item);
  });
  return [...byId.values()];
}

function mergeChatMessages(savedMessages: CreativeOsChatMessage[], incomingMessages: CreativeOsChatMessage[], actor: { email: string; name: string; accessMode?: string }) {
  const savedById = new Map(savedMessages.map(message => [idOf(message), message]).filter(([id]) => Boolean(id)) as Array<[string, CreativeOsChatMessage]>);
  const merged = new Map<string, CreativeOsChatMessage>();
  savedMessages.forEach(message => {
    const id = idOf(message);
    if (id) merged.set(id, message);
  });
  incomingMessages.forEach(message => {
    const id = idOf(message);
    if (!id || savedById.has(id)) return;
    merged.set(id, {
      ...message,
      authorEmail: actor.email,
      authorName: actor.name || actor.email,
      authorRole: actor.accessMode === 'creative-editor' ? 'editor' : 'founder',
    });
  });
  return [...merged.values()].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

function mergeCustomerState(savedState: CreativeOsState, incomingState: CreativeOsState, permissions: CreativeOsPermission[], inviteHistory: CreativeOsPermission[], actor: { email: string; name: string; accessMode?: string }): CreativeOsState {
  const deletedDeliveredEditIds = uniqueStrings([...(savedState.deletedDeliveredEditIds || []), ...(incomingState.deletedDeliveredEditIds || [])]);
  const deletedReviewIds = uniqueStrings([...(savedState.deletedReviewIds || []), ...(incomingState.deletedReviewIds || [])]);
  const incomingLaunchEditIds = new Set(incomingState.launchItems.map(item => String(item.deliveredEditId || '')).filter(Boolean));
  const activeSavedReviews = savedState.reviews.filter(review => {
    const reviewId = String(review.id || '');
    const deliveredEditId = String(review.deliveredEditId || '');
    return !deletedReviewIds.includes(reviewId) && !deletedDeliveredEditIds.includes(deliveredEditId) && !incomingLaunchEditIds.has(deliveredEditId);
  });
  return applyDeletedReviewIds({
    ...incomingState,
    permissions,
    permissionHistory: inviteHistory,
    deletedDeliveredEditIds,
    deletedReviewIds,
    deliveredEdits: mergeById(savedState.deliveredEdits, incomingState.deliveredEdits),
    reviews: mergeById(activeSavedReviews, incomingState.reviews),
    launchItems: mergeById(savedState.launchItems, incomingState.launchItems),
    chatMessages: mergeChatMessages(savedState.chatMessages, incomingState.chatMessages, actor),
  });
}

function mergeEditorState(savedState: CreativeOsState, incomingState: CreativeOsState, productIds: Set<string>, actor: { email: string; name: string; accessMode?: string }): CreativeOsState {
  const email = actor.email;
  const scopedTaskIds = new Set(savedState.tasks
    .filter(task => productIds.has(productIdOf(task)) && taskAssignedToEmail(task, email))
    .map(idOf)
    .filter(Boolean));
  const allowedEditorStatus = new Set(['in progress', 'delivered']);
  const incomingTaskById = new Map(incomingState.tasks
    .filter(task => scopedTaskIds.has(idOf(task)))
    .map(task => [idOf(task), task]));
  const tasks = savedState.tasks.map(task => {
    const incomingTask = incomingTaskById.get(idOf(task));
    if (!incomingTask) return task;
    const currentStatus = typeof task.status === 'string' ? task.status : '';
    const incomingStatus = typeof incomingTask.status === 'string' && allowedEditorStatus.has(incomingTask.status) && currentStatus !== 'delivered'
      ? incomingTask.status
      : task.status;
    return { ...task, status: incomingStatus };
  });
  const scopedIncomingEdits = incomingState.deliveredEdits.filter(edit => scopedTaskIds.has(String(edit.taskId || '')));
  const scopedIncomingEditIds = new Set(scopedIncomingEdits.map(idOf).filter(Boolean));
  const scopedIncomingReviews = incomingState.reviews.filter(review => scopedIncomingEditIds.has(String(review.deliveredEditId || '')));
  const scopedRoomIds = new Set(tasks
    .filter(task => scopedTaskIds.has(idOf(task)))
    .flatMap(task => [taskRoomId(task), taskLegacyParticipantChatRoomId(task), taskParticipantChatRoomId(task)])
    .filter(Boolean));
  const scopedIncomingMessages = incomingState.chatMessages.filter(message => scopedRoomIds.has(String(message.roomId || '')));

  return {
    ...savedState,
    activeProductId: savedState.activeProductId,
    activeSection: savedState.activeSection,
    products: savedState.products,
    sources: savedState.sources,
    deletedTaskIds: savedState.deletedTaskIds,
    deletedSourceIds: savedState.deletedSourceIds,
    deletedDeliveredEditIds: savedState.deletedDeliveredEditIds,
    deletedReviewIds: savedState.deletedReviewIds,
    tasks,
    deliveredEdits: mergeById(savedState.deliveredEdits, scopedIncomingEdits),
    reviews: mergeById(savedState.reviews, scopedIncomingReviews),
    launchItems: savedState.launchItems,
    performance: savedState.performance,
    chatMessages: mergeChatMessages(savedState.chatMessages, scopedIncomingMessages, actor),
    permissions: savedState.permissions,
    permissionHistory: savedState.permissionHistory,
  };
}

async function getActor(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const jwt = token ? await verifyJwt(token) : null;
  return { email: jwt?.email || '', name: jwt?.name || jwt?.email || 'Unknown', accessMode: jwt?.accessMode || 'customer' };
}

async function ensureStore() {
  await ensureCreativeOsStores();
}

async function applyServerInviteState(tenantId: string, state: CreativeOsState): Promise<CreativeOsState> {
  const invites = await getInvitesForTenant(tenantId);
  return {
    ...applySourceLifecycle(state),
    permissions: mergeInvitePermissions(state.permissions, invites),
    permissionHistory: inviteHistoryPermissions(invites),
  };
}

function productFromCatalogItem(item: any, index: number, source: string): CreativeOsProduct | null {
  const title = String(item?.title || item?.name || '').trim();
  if (!title) return null;
  const url = String(item?.url || item?.productUrl || item?.default_url || '').trim();
  const imageUrl = String(item?.image || item?.imageUrl || item?.image_url || item?.thumbnail || '').trim();
  return {
    id: `${source}-${Buffer.from(`${title}::${url || index}`).toString('base64url')}`,
    name: title,
    url,
    imageUrl,
    explanation: [item?.price ? `Price: ${item.price}` : '', item?.description || ''].filter(Boolean).join(' '),
    sellingPoints: [],
    pains: [],
    personas: [],
    claimBoundaries: [],
    defaultDerivativeCap: 5,
    platforms: [],
    namingConvention: 'product-source-edit-platform',
    createdAt: new Date().toISOString(),
  };
}

async function loadCatalogProducts(tenantId: string): Promise<CreativeOsProduct[]> {
  const byKey = new Map<string, CreativeOsProduct>();
  const add = (product: CreativeOsProduct | null) => {
    if (!product) return;
    const key = `${product.name.toLowerCase()}|${product.url}`;
    if (!byKey.has(key)) byKey.set(key, product);
  };

  const result = await db.execute({
    sql: `SELECT id, title, default_url, image_urls, metadata, created_at FROM ad_products WHERE tenant_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 80`,
    args: [tenantId],
  });
  result.rows.forEach(row => {
    const images = parseJsonArray(row.image_urls);
    add({
      id: String(row.id),
      name: String(row.title || ''),
      url: String(row.default_url || ''),
      imageUrl: images[0] || '',
      explanation: '',
      sellingPoints: [],
      pains: [],
      personas: [],
      claimBoundaries: [],
      defaultDerivativeCap: 5,
      platforms: [],
      namingConvention: 'product-source-edit-platform',
      createdAt: String(row.created_at || new Date().toISOString()),
    });
  });

  const rawProfile = await getTenantConfig(tenantId, 'brand_profile');
  if (rawProfile) {
    try {
      const profile = JSON.parse(rawProfile);
      const summary = profile?.source_summary || {};
      const catalog = Array.isArray(summary.product_catalog) ? summary.product_catalog : [];
      const topProducts = Array.isArray(summary.top_products) ? summary.top_products : [];
      [...catalog, ...topProducts].forEach((item, index) => add(productFromCatalogItem(item, index, 'catalog')));
    } catch {}
  }

  return [...byKey.values()].slice(0, 80);
}

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    await ensureStore();
    const actor = await getActor(request);
    const stored = await db.execute({ sql: `SELECT state_json FROM creative_os_state WHERE tenant_id = ? LIMIT 1`, args: [tenantId] });
    const savedState = stored.rows[0]?.state_json ? normalizeState(JSON.parse(String(stored.rows[0].state_json))) : emptyState();
    const state = await applyServerInviteState(tenantId, savedState);
    const invites = await getInvitesForTenant(tenantId);
    const editorProductIds = actor.accessMode === 'creative-editor' ? editorProductIdsForState(invites, state, actor.email) : new Set<string>();
    const responseState = actor.accessMode === 'creative-editor'
      ? filterStateForEditor(state, editorProductIds, actor.email)
      : state;
    const catalogProducts = await loadCatalogProducts(tenantId);
    const workspace = {};
    return Response.json({ state: responseState, catalogProducts, actor, workspace, backend: 'database', canWrite: true });
  } catch (err) {
    console.error('[Creative OS GET]', err);
    return Response.json({ error: 'Failed to load Creative OS' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: { tenant_id?: string; state?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let tenantId: string;
  try {
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    await ensureStore();
    const actor = await getActor(request);
    const incomingState = normalizeState(body.state);
    const saved = await db.execute({ sql: `SELECT state_json FROM creative_os_state WHERE tenant_id = ? LIMIT 1`, args: [tenantId] });
    const savedState = saved.rows[0]?.state_json ? normalizeState(JSON.parse(String(saved.rows[0].state_json))) : emptyState();
    const invalidFinishedAd = invalidSubmittedFinishedAd(savedState, incomingState);
    if (invalidFinishedAd) {
      return Response.json({
        error: 'Finished ads must be submitted as direct https links.',
      }, { status: 400 });
    }
    const invites = await getInvitesForTenant(tenantId);
    const sanitizedIncomingPermissions = sanitizeStoredPermissions(incomingState.permissions)
      .filter(permission => normalizeInviteStatus(permission.status) === 'accepted');
    const preservedPermissions = mergeInvitePermissions(
      actor.accessMode === 'creative-editor'
        ? savedState.permissions
        : [...savedState.permissions, ...sanitizedIncomingPermissions],
      invites,
    );
    const editorProductIds = actor.accessMode === 'creative-editor' ? editorProductIdsForState(invites, savedState, actor.email) : new Set<string>();
    const state = actor.accessMode === 'creative-editor'
      ? mergeEditorState(savedState, incomingState, editorProductIds, actor)
      : mergeCustomerState(savedState, incomingState, preservedPermissions, inviteHistoryPermissions(invites), actor);
    if (!state.products.length) state.activeProductId = '';
    if (state.products.length && !state.products.some(product => product.id === state.activeProductId)) state.activeProductId = state.products[0].id;
    const lifecycleState = applySourceLifecycle(repairIncompleteMultiOutputTasks(applyDeletedReviewIds(applyDeletedSourceIds(applyDeletedTaskIds(state)))));
    const responseState = actor.accessMode === 'creative-editor'
      ? filterStateForEditor(lifecycleState, editorProductIds, actor.email)
      : lifecycleState;

    await db.execute({
      sql: `INSERT INTO creative_os_state (tenant_id, state_json, updated_by, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(tenant_id) DO UPDATE SET state_json = excluded.state_json, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
      args: [tenantId, JSON.stringify(lifecycleState), actor.email],
    });
    await db.execute({
      sql: `INSERT INTO ad_audit_log (id, tenant_id, actor, action, entity_type, entity_id, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), tenantId, actor.email, 'creative_os_state.save', 'creative_os_state', tenantId, JSON.stringify({ productCount: lifecycleState.products.length }), 'Creative OS UI save'],
    });
    await notifyCreativeOsStateChanges({
      request,
      tenantId,
      actor,
      previousState: savedState,
      nextState: lifecycleState,
    }).catch(error => {
      console.warn('[Creative OS notifications]', error instanceof Error ? error.message : error);
    });
    return Response.json({ ok: true, state: responseState, updatedBy: actor.email });
  } catch (err) {
    console.error('[Creative OS POST]', err);
    return Response.json({ error: 'Failed to save Creative OS' }, { status: 500 });
  }
}
