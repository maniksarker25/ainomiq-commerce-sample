import {
  emptyState,
  type BrandProfile,
  type BrandReferenceLink,
  type ChatMessage,
  type CreativeOsState,
} from "../types";
import { normalizeAiProductFields } from "./products";
import { taskChatRoomId } from "./tasks";

export function uniqueStrings(values: unknown[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

export function mergeById<T extends { id?: string }>(base: T[], incoming: T[]) {
  const byId = new Map<string, T>();
  base.forEach((item) => {
    if (item.id) byId.set(item.id, item);
  });
  incoming.forEach((item) => {
    if (item.id) byId.set(item.id, item);
  });
  return [...byId.values()];
}

export function normalizeBrandReferenceLinks(
  input: unknown,
  options: { keepEmpty?: boolean; keepDraftSpacing?: boolean } = {},
): BrandReferenceLink[] {
  const items = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/\n|,/).map((url) => ({ url }))
      : [];
  return items
    .map((item, index) => {
      const candidate =
        item && typeof item === "object"
          ? (item as Partial<BrandReferenceLink> & {
              note?: string;
              description?: string;
            })
          : {};
      const url =
        typeof candidate.url === "string"
          ? options.keepDraftSpacing
            ? candidate.url
            : candidate.url.trim()
          : "";
      const info =
        typeof candidate.info === "string"
          ? options.keepDraftSpacing
            ? candidate.info
            : candidate.info.trim()
          : typeof candidate.note === "string"
            ? options.keepDraftSpacing
              ? candidate.note
              : candidate.note.trim()
            : typeof candidate.description === "string"
              ? options.keepDraftSpacing
                ? candidate.description
                : candidate.description.trim()
              : "";
      const id =
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id.trim()
          : `brand-reference-${index}-${
              url
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .slice(0, 32) || "link"
            }`;
      return { id, url, info };
    })
    .filter((item) => options.keepEmpty || item.url.trim() || item.info.trim());
}

export function normalizeBrandProfile(
  input: unknown,
  options: {
    keepEmptyReferenceLinks?: boolean;
    keepDraftReferenceSpacing?: boolean;
  } = {},
): BrandProfile {
  const candidate =
    input && typeof input === "object" ? (input as Partial<BrandProfile>) : {};
  return {
    name: typeof candidate.name === "string" ? candidate.name : "",
    story: typeof candidate.story === "string" ? candidate.story : "",
    voice: typeof candidate.voice === "string" ? candidate.voice : "",
    instructions:
      typeof candidate.instructions === "string" ? candidate.instructions : "",
    doNotSay: typeof candidate.doNotSay === "string" ? candidate.doNotSay : "",
    referenceLinks: normalizeBrandReferenceLinks(candidate.referenceLinks, {
      keepEmpty: options.keepEmptyReferenceLinks,
      keepDraftSpacing: options.keepDraftReferenceSpacing,
    }),
  };
}

export function normalizeBrandDraftProfile(input: unknown): BrandProfile {
  return normalizeBrandProfile(input, {
    keepEmptyReferenceLinks: true,
    keepDraftReferenceSpacing: true,
  });
}

export function normalizeChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const candidate =
        item && typeof item === "object" ? (item as Partial<ChatMessage>) : {};
      const roomId =
        typeof candidate.roomId === "string" ? candidate.roomId.trim() : "";
      const taskId =
        typeof candidate.taskId === "string" ? candidate.taskId.trim() : "";
      const body =
        typeof candidate.body === "string" ? candidate.body.trim() : "";
      if (!roomId || !taskId || !body) return null;
      return {
        id:
          typeof candidate.id === "string" && candidate.id.trim()
            ? candidate.id.trim()
            : `chat-${Date.now()}-${index}`,
        productId:
          typeof candidate.productId === "string" ? candidate.productId : "",
        taskId,
        roomId,
        authorEmail:
          typeof candidate.authorEmail === "string"
            ? candidate.authorEmail
            : "",
        authorName:
          typeof candidate.authorName === "string" ? candidate.authorName : "",
        authorRole: candidate.authorRole === "editor" ? "editor" : "founder",
        body,
        createdAt:
          typeof candidate.createdAt === "string"
            ? candidate.createdAt
            : new Date().toISOString(),
      } satisfies ChatMessage;
    })
    .filter((item): item is ChatMessage => Boolean(item));
}

export function applyDeletedTaskIds(
  state: CreativeOsState,
  extraDeletedTaskIds: string[] = [],
): CreativeOsState {
  const deletedTaskIds = uniqueStrings([
    ...(Array.isArray(state.deletedTaskIds) ? state.deletedTaskIds : []),
    ...extraDeletedTaskIds,
  ]);
  if (!deletedTaskIds.length) return { ...state, deletedTaskIds: [] };

  const deletedTaskIdSet = new Set(deletedTaskIds);
  const deletedEditIds = new Set(
    state.deliveredEdits
      .filter((edit) => deletedTaskIdSet.has(edit.taskId))
      .map((edit) => edit.id),
  );
  const deletedLaunchIds = new Set(
    state.launchItems
      .filter((item) => deletedEditIds.has(item.deliveredEditId))
      .map((item) => item.id),
  );
  const deletedRoomIds = new Set(
    state.tasks
      .filter((task) => deletedTaskIdSet.has(task.id))
      .map((task) => taskChatRoomId(task)),
  );

  return {
    ...state,
    deletedTaskIds,
    tasks: state.tasks.filter((task) => !deletedTaskIdSet.has(task.id)),
    deliveredEdits: state.deliveredEdits.filter(
      (edit) => !deletedTaskIdSet.has(edit.taskId),
    ),
    reviews: state.reviews.filter(
      (review) => !deletedEditIds.has(review.deliveredEditId),
    ),
    launchItems: state.launchItems.filter(
      (item) => !deletedEditIds.has(item.deliveredEditId),
    ),
    performance: state.performance.filter(
      (item) => !deletedLaunchIds.has(item.launchItemId),
    ),
    chatMessages: state.chatMessages.filter(
      (message) => !deletedRoomIds.has(message.roomId),
    ),
  };
}

export function applyDeletedSourceIds(
  state: CreativeOsState,
  extraDeletedSourceIds: string[] = [],
): CreativeOsState {
  const deletedSourceIds = uniqueStrings([
    ...(Array.isArray(state.deletedSourceIds) ? state.deletedSourceIds : []),
    ...extraDeletedSourceIds,
  ]);
  if (!deletedSourceIds.length) return { ...state, deletedSourceIds: [] };

  const deletedSourceIdSet = new Set(deletedSourceIds);
  return {
    ...state,
    deletedSourceIds,
    sources: state.sources.filter(
      (source) => !deletedSourceIdSet.has(source.id),
    ),
  };
}

export function applyDeletedReviewIds(state: CreativeOsState): CreativeOsState {
  const deletedDeliveredEditIds = uniqueStrings(
    Array.isArray(state.deletedDeliveredEditIds)
      ? state.deletedDeliveredEditIds
      : [],
  );
  const deletedReviewIds = uniqueStrings(
    Array.isArray(state.deletedReviewIds) ? state.deletedReviewIds : [],
  );
  if (!deletedDeliveredEditIds.length && !deletedReviewIds.length)
    return { ...state, deletedDeliveredEditIds: [], deletedReviewIds: [] };
  const deletedEditIdSet = new Set(deletedDeliveredEditIds);
  const deletedReviewIdSet = new Set(deletedReviewIds);
  return {
    ...state,
    deletedDeliveredEditIds,
    deletedReviewIds,
    deliveredEdits: state.deliveredEdits.filter(
      (edit) => !deletedEditIdSet.has(edit.id),
    ),
    reviews: state.reviews.filter(
      (review) =>
        !deletedReviewIdSet.has(review.id) &&
        !deletedEditIdSet.has(review.deliveredEditId),
    ),
    launchItems: state.launchItems.filter(
      (item) => !deletedEditIdSet.has(item.deliveredEditId),
    ),
  };
}

export function applyDeletedChatMessageIds(state: CreativeOsState): CreativeOsState {
  const deletedChatMessageIds = uniqueStrings(
    Array.isArray(state.deletedChatMessageIds)
      ? state.deletedChatMessageIds
      : [],
  );
  if (!deletedChatMessageIds.length)
    return { ...state, deletedChatMessageIds: [] };
  const deletedChatMessageIdSet = new Set(deletedChatMessageIds);
  return {
    ...state,
    deletedChatMessageIds,
    chatMessages: state.chatMessages.filter(
      (message) => !deletedChatMessageIdSet.has(message.id),
    ),
  };
}

function repairIncompleteMultiOutputTasks(state: CreativeOsState): CreativeOsState {
  const editTaskIdById = new Map<string, string>();
  for (const edit of state.deliveredEdits) {
    editTaskIdById.set(edit.id, edit.taskId);
  }
  const approvedCountByTaskId = new Map<string, number>();
  for (const launch of state.launchItems) {
    const taskId = editTaskIdById.get(launch.deliveredEditId);
    if (!taskId) continue;
    approvedCountByTaskId.set(
      taskId,
      (approvedCountByTaskId.get(taskId) || 0) + 1,
    );
  }
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.status !== "delivered") return task;
      const expectedOutputs = Math.max(1, Number(task.outputCount) || 1);
      const approvedCount = approvedCountByTaskId.get(task.id) || 0;
      return approvedCount < expectedOutputs
        ? { ...task, status: "in progress" }
        : task;
    }),
  };
}

export function normalizeCreativeOsState(
  input: CreativeOsState | undefined,
  tenantId: string,
): CreativeOsState {
  const fallback = emptyState(tenantId);
  const state = input || fallback;
  const realPermissions = Array.isArray(state.permissions)
    ? state.permissions
        .filter(
          (permission) =>
            permission.userName.trim().toLowerCase() !==
            "ainomiq creative team",
        )
        .map((permission) => ({
          ...permission,
          status: [
            "invited",
            "accepted",
            "rejected",
            "revoked",
            "expired",
          ].includes(permission.status)
            ? permission.status
            : "accepted",
          email:
            typeof permission.email === "string" ? permission.email.trim() : "",
          invitedAt:
            typeof permission.invitedAt === "string"
              ? permission.invitedAt
              : undefined,
          respondedAt:
            typeof permission.respondedAt === "string"
              ? permission.respondedAt
              : undefined,
          revokedAt:
            typeof permission.revokedAt === "string"
              ? permission.revokedAt
              : undefined,
          inviteToken:
            typeof permission.inviteToken === "string"
              ? permission.inviteToken
              : undefined,
          inviteSentAt:
            typeof permission.inviteSentAt === "string"
              ? permission.inviteSentAt
              : undefined,
          expiresAt:
            typeof permission.expiresAt === "string"
              ? permission.expiresAt
              : undefined,
          lastEmailError:
            typeof permission.lastEmailError === "string"
              ? permission.lastEmailError
              : undefined,
        }))
    : [];
  const permissionHistory = Array.isArray(state.permissionHistory)
    ? state.permissionHistory
        .filter(
          (permission) =>
            permission.userName.trim().toLowerCase() !==
            "ainomiq creative team",
        )
        .map((permission) => ({
          ...permission,
          status: [
            "invited",
            "accepted",
            "rejected",
            "revoked",
            "expired",
          ].includes(permission.status)
            ? permission.status
            : "accepted",
          email:
            typeof permission.email === "string" ? permission.email.trim() : "",
        }))
    : [];
  return repairIncompleteMultiOutputTasks(
    applyDeletedChatMessageIds(
      applyDeletedReviewIds(
        applyDeletedSourceIds(
          applyDeletedTaskIds({
            ...state,
            brand: normalizeBrandProfile(
              (state as Partial<CreativeOsState>).brand,
            ),
            products: Array.isArray(state.products)
              ? state.products.map(normalizeAiProductFields)
              : [],
            permissions: realPermissions,
            permissionHistory,
            tasks: Array.isArray(state.tasks)
              ? state.tasks.map((task) => ({
                  ...task,
                  assignee:
                    task.assignee.trim().toLowerCase() ===
                    "ainomiq creative team"
                      ? "Unassigned"
                      : task.assignee,
                }))
              : [],
            deletedTaskIds: uniqueStrings(
              Array.isArray(state.deletedTaskIds) ? state.deletedTaskIds : [],
            ),
            deletedSourceIds: uniqueStrings(
              Array.isArray(state.deletedSourceIds)
                ? state.deletedSourceIds
                : [],
            ),
            deletedDeliveredEditIds: uniqueStrings(
              Array.isArray(state.deletedDeliveredEditIds)
                ? state.deletedDeliveredEditIds
                : [],
            ),
            deletedReviewIds: uniqueStrings(
              Array.isArray(state.deletedReviewIds)
                ? state.deletedReviewIds
                : [],
            ),
            deletedChatMessageIds: uniqueStrings(
              Array.isArray(state.deletedChatMessageIds)
                ? state.deletedChatMessageIds
                : [],
            ),
            chatMessages: normalizeChatMessages(
              (state as Partial<CreativeOsState>).chatMessages,
            ),
          }),
        ),
      ),
    ),
  );
}

export function mergeCreativeOsState(
  current: CreativeOsState,
  remoteState: CreativeOsState,
  protectedProductIds: string[] = [],
) {
  const mergedState = applyDeletedChatMessageIds(
    applyDeletedReviewIds(
      applyDeletedSourceIds(
        applyDeletedTaskIds(
          {
            ...remoteState,
            activeSection: current.activeSection,
            deletedDeliveredEditIds: uniqueStrings([
              ...(remoteState.deletedDeliveredEditIds || []),
              ...(current.deletedDeliveredEditIds || []),
            ]),
            deletedReviewIds: uniqueStrings([
              ...(remoteState.deletedReviewIds || []),
              ...(current.deletedReviewIds || []),
            ]),
            deletedChatMessageIds: uniqueStrings([
              ...(remoteState.deletedChatMessageIds || []),
              ...(current.deletedChatMessageIds || []),
            ]),
            chatMessages: mergeById(
              remoteState.chatMessages || [],
              current.chatMessages || [],
            ),
          },
          current.deletedTaskIds || [],
        ),
        current.deletedSourceIds || [],
      ),
    ),
  );
  const protectedProductIdSet = new Set(protectedProductIds);
  const mergedProductIds = new Set(
    mergedState.products.map((product) => product.id),
  );
  const localProtectedProducts = current.products.filter(
    (product) =>
      protectedProductIdSet.has(product.id) &&
      !mergedProductIds.has(product.id),
  );
  const products = localProtectedProducts.length
    ? [...mergedState.products, ...localProtectedProducts]
    : mergedState.products;
  const activeProductId = products.some(
    (product) => product.id === current.activeProductId,
  )
    ? current.activeProductId
    : mergedState.activeProductId;
  return {
    ...mergedState,
    products,
    activeProductId,
    brand:
      current.activeSection === "brand" ? current.brand : mergedState.brand,
  };
}

/** @deprecated Use mergeCreativeOsState */
export const mergeRemoteCreativeOsState = mergeCreativeOsState;
