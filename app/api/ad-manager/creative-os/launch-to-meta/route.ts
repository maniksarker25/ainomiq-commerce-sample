import { NextRequest } from "next/server";
import { deflateSync } from "zlib";
import { db } from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { getMetaToken, metaFetch, MetaError } from "@/lib/meta";
import { resolveFacebookPage } from "@/lib/cs-social";
import {
  adsetDefaultsForObjective,
  buildTargeting,
  objectiveForMeta,
} from "@/lib/ad-manager/meta-adset-defaults";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type CreativeOsState = {
  products?: Array<{ id?: string; name?: string; url?: string }>;
  tasks?: Array<{ id?: string; brief?: string; notes?: string; productId?: string }>;
  deliveredEdits?: Array<{
    id?: string;
    taskId?: string;
    productId?: string;
    previewUrl?: string;
    briefSummary?: string;
  }>;
  launchItems?: Array<{
    id?: string;
    productId?: string;
    deliveredEditId?: string;
    approvedCreative?: string;
    recommendedAdName?: string;
    status?: string;
    [key: string]: unknown;
  }>;
};

type LaunchContext = {
  launchItem: NonNullable<CreativeOsState["launchItems"]>[number];
  edit?: NonNullable<CreativeOsState["deliveredEdits"]>[number];
  task?: NonNullable<CreativeOsState["tasks"]>[number];
  product?: NonNullable<CreativeOsState["products"]>[number];
};

type MetaAdsetTemplate = {
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  targeting?: unknown;
  promoted_object?: unknown;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  bid_amount?: string;
  regional_regulated_categories?: unknown;
  regional_regulation_identities?: unknown;
};

function clean(value: unknown, max = 500) {
  return String(value || "")
    .trim()
    .replace(/[\u2013\u2014]/g, " - ")
    .slice(0, max);
}

function parseBudgetCents(value: unknown, fallback = 2000) {
  const raw = String(value || "").replace(/[^0-9.,]/g, "").replace(",", ".");
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;
  return Math.max(Math.round(amount * 100), 100);
}

function parseMetaStartTime(value: unknown) {
  const raw = clean(value, 80);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("Start time must be a valid date and time.");
  if (date.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new Error("Start time must be now or in the future.");
  }
  return date.toISOString();
}

function isFutureMetaStartTime(value: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now() + 60 * 1000;
}

function assertHttpUrl(value: string, label: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad protocol");
    return url.toString();
  } catch {
    throw new Error(`${label} must be a valid http or https URL.`);
  }
}

function filenameFromUrl(value: string, fallback: string) {
  try {
    const name = decodeURIComponent(new URL(value).pathname.split("/").filter(Boolean).pop() || "");
    return name || fallback;
  } catch {
    return fallback;
  }
}

function isVideoMedia(url: string, contentType: string) {
  return contentType.startsWith("video/") || /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createMetaFallbackThumbnailPng() {
  const width = 1200;
  const height = 628;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0;
  for (let index = 1; index < row.length; index += 3) {
    row[index] = 245;
    row[index + 1] = 247;
    row[index + 2] = 255;
  }
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function adsManagerUrl(adAccountId: string, adId: string) {
  const account = adAccountId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(account)}&selected_ad_ids=${encodeURIComponent(adId)}`;
}

function adsManagerSelectedUrl(adAccountId: string, adIds: string[]) {
  const account = adAccountId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(account)}&selected_ad_ids=${encodeURIComponent(adIds.join(","))}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => clean(value, 240)).filter(Boolean)));
}

function includesTaiwanValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(includesTaiwanValue);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(includesTaiwanValue);
  }
  const normalized = clean(value, 80).toLowerCase();
  return normalized === "tw" || normalized === "taiwan";
}

function targetingIncludesTaiwan(targeting: unknown) {
  if (!targeting || typeof targeting !== "object") return false;
  return includesTaiwanValue((targeting as Record<string, unknown>).geo_locations);
}

function applyRegionalCompliance(payload: Record<string, unknown>) {
  if (!targetingIncludesTaiwan(payload.targeting)) return payload;
  const categories = Array.isArray(payload.regional_regulated_categories)
    ? payload.regional_regulated_categories.map((value) => clean(value, 80)).filter(Boolean)
    : [];
  if (!categories.includes("TAIWAN_UNIVERSAL")) {
    payload.regional_regulated_categories = [...categories, "TAIWAN_UNIVERSAL"];
  }
  return payload;
}

function applyAdsetTemplate(
  payload: Record<string, unknown>,
  template: MetaAdsetTemplate | null,
) {
  if (!template) return payload;
  if (template.targeting && typeof template.targeting === "object") {
    payload.targeting = template.targeting;
  }
  if (template.promoted_object && typeof template.promoted_object === "object") {
    payload.promoted_object = template.promoted_object;
  }
  if (template.optimization_goal) payload.optimization_goal = template.optimization_goal;
  if (template.billing_event) payload.billing_event = template.billing_event;
  if (template.bid_strategy) payload.bid_strategy = template.bid_strategy;
  if (template.bid_amount) payload.bid_amount = template.bid_amount;
  if (template.regional_regulated_categories) {
    payload.regional_regulated_categories = template.regional_regulated_categories;
  }
  if (template.regional_regulation_identities) {
    payload.regional_regulation_identities = template.regional_regulation_identities;
  }
  return payload;
}

async function loadAdsetTemplate(
  token: string,
  sourceAdsetId: string,
  campaignId: string,
): Promise<MetaAdsetTemplate | null> {
  const id = clean(sourceAdsetId, 120);
  if (!id) return null;
  const data = await metaFetch(
    token,
    `/${encodeURIComponent(id)}?fields=campaign_id,status,effective_status,targeting,promoted_object,optimization_goal,billing_event,bid_strategy,bid_amount,regional_regulated_categories,regional_regulation_identities`,
  );
  if (String(data?.campaign_id || "") !== campaignId) {
    throw new Error("Choose a targeting template from the selected campaign.");
  }
  const status = String(data?.effective_status || data?.status || "").toUpperCase();
  if (status !== "ACTIVE") {
    throw new Error("Choose a live ad set to copy targeting from.");
  }
  return {
    campaign_id: data?.campaign_id ? String(data.campaign_id) : undefined,
    status: data?.status ? String(data.status) : undefined,
    effective_status: data?.effective_status ? String(data.effective_status) : undefined,
    targeting: data?.targeting,
    promoted_object: data?.promoted_object,
    optimization_goal: data?.optimization_goal ? String(data.optimization_goal) : undefined,
    billing_event: data?.billing_event ? String(data.billing_event) : undefined,
    bid_strategy: data?.bid_strategy ? String(data.bid_strategy) : undefined,
    bid_amount: data?.bid_amount ? String(data.bid_amount) : undefined,
    regional_regulated_categories: data?.regional_regulated_categories,
    regional_regulation_identities: data?.regional_regulation_identities,
  };
}

function resolveLaunchContext(state: CreativeOsState, launchItemId: string): LaunchContext {
  const launchItem = (state.launchItems || []).find((item) => item.id === launchItemId);
  if (!launchItem) throw new Error(`Launch item not found: ${launchItemId}`);
  const edit = (state.deliveredEdits || []).find((item) => item.id === launchItem.deliveredEditId);
  const task = edit ? (state.tasks || []).find((item) => item.id === edit.taskId) : undefined;
  const product = (state.products || []).find(
    (item) => item.id === launchItem.productId || item.id === edit?.productId,
  );
  return { launchItem, edit, task, product };
}

async function resolvePageId(tenantId: string, token: string) {
  const fbPage = await resolveFacebookPage(tenantId);
  if (fbPage?.pageId) return fbPage.pageId;

  const pageAccounts = await metaFetch(token, "/me/accounts?fields=id,name&limit=50");
  const firstPage = Array.isArray(pageAccounts?.data) ? pageAccounts.data[0] : null;
  if (firstPage?.id) return String(firstPage.id);
  throw new Error("Connect a Facebook Page before creating ads in Meta.");
}

function pickVideoThumbnailUrl(data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const rows = Array.isArray(record.data)
    ? record.data
    : record.thumbnails &&
        typeof record.thumbnails === "object" &&
        Array.isArray((record.thumbnails as Record<string, unknown>).data)
      ? ((record.thumbnails as Record<string, unknown>).data as unknown[])
      : [];
  const thumbnails = rows
    .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
    .filter(Boolean) as Array<Record<string, unknown>>;
  const preferred = thumbnails.find((row) => row.is_preferred === true) || thumbnails[0];
  return clean(preferred?.uri, 1200);
}

async function loadVideoThumbnailUrl(token: string, videoId: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(1000);
    try {
      const thumbnails = await metaFetch(
        token,
        `/${encodeURIComponent(videoId)}/thumbnails?fields=uri,is_preferred&limit=10`,
      );
      const thumbnailUrl = pickVideoThumbnailUrl(thumbnails);
      if (thumbnailUrl) return thumbnailUrl;
    } catch {
      // Some Meta video objects expose thumbnails only through the nested field below.
    }
    try {
      const video = await metaFetch(token, `/${encodeURIComponent(videoId)}?fields=thumbnails{uri,is_preferred}`);
      const thumbnailUrl = pickVideoThumbnailUrl(video);
      if (thumbnailUrl) return thumbnailUrl;
    } catch {
      // Keep polling briefly while Meta finishes video thumbnail processing.
    }
  }
  return "";
}

async function uploadMetaImageHash(input: {
  token: string;
  adAccountId: string;
  bytes: BlobPart;
  contentType: string;
  fileName: string;
}) {
  const formData = new FormData();
  const accountPath = `act_${input.adAccountId.replace("act_", "")}`;
  formData.append("file", new Blob([input.bytes], { type: input.contentType }), input.fileName);
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(accountPath)}/adimages?access_token=${encodeURIComponent(input.token)}`,
    { method: "POST", body: formData },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Meta image upload failed: ${detail.slice(0, 500)}`);
  }
  const data = await response.json();
  const imageDetails = Object.values(data.images || {})[0] as { hash?: string } | undefined;
  if (!imageDetails?.hash) throw new Error("Meta did not return an image hash.");
  return imageDetails.hash;
}

async function uploadCreativeMedia(token: string, adAccountId: string, assetUrl: string) {
  const mediaResponse = await fetch(assetUrl);
  if (!mediaResponse.ok) {
    throw new Error(`Could not fetch approved ad media (${mediaResponse.status}).`);
  }

  const contentType = mediaResponse.headers.get("content-type") || "application/octet-stream";
  const bytes = await mediaResponse.arrayBuffer();
  const fileName = filenameFromUrl(assetUrl, isVideoMedia(assetUrl, contentType) ? "creative-os-video.mp4" : "creative-os-image.png");
  const blob = new Blob([bytes], { type: contentType });
  const formData = new FormData();
  const accountPath = `act_${adAccountId.replace("act_", "")}`;

  if (isVideoMedia(assetUrl, contentType)) {
    formData.append("source", blob, fileName);
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(accountPath)}/advideos?access_token=${encodeURIComponent(token)}`,
      { method: "POST", body: formData },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Meta video upload failed: ${detail.slice(0, 500)}`);
    }
    const data = await response.json();
    if (!data?.id) throw new Error("Meta did not return a video id.");
    const thumbnailUrl = await loadVideoThumbnailUrl(token, String(data.id));
    const thumbnailImageHash = thumbnailUrl
      ? ""
      : await uploadMetaImageHash({
          token,
          adAccountId,
          bytes: createMetaFallbackThumbnailPng(),
          contentType: "image/png",
          fileName: "creative-os-video-thumbnail.png",
        });
    return { type: "video" as const, id: String(data.id), thumbnailUrl, thumbnailImageHash };
  }

  return {
    type: "image" as const,
    hash: await uploadMetaImageHash({ token, adAccountId, bytes, contentType, fileName }),
  };
}

async function firstPixelId(token: string, adAccountId: string) {
  try {
    const data = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adspixels?fields=id,name&limit=5`);
    const first = Array.isArray(data?.data) ? data.data[0] : null;
    return first?.id ? String(first.id) : "";
  } catch {
    return "";
  }
}

async function prepareMetaAdCreative(input: {
  token: string;
  adAccountId: string;
  pageId: string;
  context: LaunchContext;
  landingPageUrl: string;
  cta: string;
  adName?: unknown;
  primaryText?: unknown;
  headline?: unknown;
  forceItemCopy: boolean;
}) {
  const { token, adAccountId, pageId, context, landingPageUrl, cta, forceItemCopy } = input;
  const { launchItem, edit, task, product } = context;
  const assetUrl = assertHttpUrl(clean(edit?.previewUrl || launchItem.approvedCreative, 1200), "Approved ad media");
  const primaryText = clean(
    input.primaryText || (forceItemCopy ? launchItem.approvedCreative || task?.notes : launchItem.approvedCreative || task?.notes),
    2000,
  );
  const headline = clean(
    input.headline || (forceItemCopy ? task?.brief || launchItem.recommendedAdName || product?.name : task?.brief || launchItem.recommendedAdName || product?.name),
    255,
  );
  const baseAdName = clean(input.adName || launchItem.recommendedAdName || headline, 220);
  const adName = clean(
    forceItemCopy
      ? `${baseAdName} - ${task?.brief || launchItem.recommendedAdName || launchItem.id}`
      : baseAdName,
    255,
  );
  if (!primaryText) throw new Error("Primary text is required.");
  if (!headline) throw new Error("Headline is required.");
  if (!adName) throw new Error("Ad name is required.");

  const media = await uploadCreativeMedia(token, adAccountId, assetUrl);
  const creativePayload =
    media.type === "video"
      ? {
          name: adName,
          object_story_spec: {
            page_id: pageId,
            video_data: {
              video_id: media.id,
              ...(media.thumbnailUrl ? { image_url: media.thumbnailUrl } : { image_hash: media.thumbnailImageHash }),
              title: headline,
              message: primaryText,
              call_to_action: { type: cta, value: { link: landingPageUrl } },
            },
          },
        }
      : {
          name: adName,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              image_hash: media.hash,
              link: landingPageUrl,
              message: primaryText,
              name: headline,
              call_to_action: { type: cta, value: { link: landingPageUrl } },
            },
          },
        };

  const creative = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adcreatives`, {
    method: "POST",
    body: JSON.stringify(creativePayload),
  });
  const creativeId = String(creative.id || "");
  if (!creativeId) throw new Error("Meta did not return an ad creative id.");

  return {
    launchItemId: String(launchItem.id || ""),
    mediaType: media.type,
    creativeId,
    adName,
    headline,
  };
}

type PreparedMetaAdCreative = Awaited<ReturnType<typeof prepareMetaAdCreative>>;

async function createPausedMetaAd(input: {
  token: string;
  adAccountId: string;
  adsetId: string;
  prepared: PreparedMetaAdCreative;
  adStatus: "ACTIVE" | "PAUSED";
}) {
  const { token, adAccountId, adsetId, prepared, adStatus } = input;
  const ad = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/ads`, {
    method: "POST",
    body: JSON.stringify({
      name: prepared.adName,
      adset_id: adsetId,
      creative: { creative_id: prepared.creativeId },
      status: adStatus,
    }),
  });
  const adId = String(ad.id || "");
  if (!adId) throw new Error("Meta did not return an ad id.");

  return {
    launchItemId: prepared.launchItemId,
    mediaType: prepared.mediaType,
    patch: {
      status: "uploaded",
      metaCreativeId: prepared.creativeId,
      metaAdId: adId,
      metaLaunchUrl: adsManagerUrl(adAccountId, adId),
      launchedAt: new Date().toISOString(),
      launchError: "",
    },
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  let tenantId: string;

  try {
    body = await request.json();
    tenantId = await requireAuth(request, clean(body.tenant_id, 160));
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const requestedIds = uniqueStrings([
      ...(Array.isArray(body.launch_item_ids) ? body.launch_item_ids.map((id) => String(id || "")) : []),
      clean(body.launch_item_id, 160),
    ]);
    if (!requestedIds.length) throw new Error("Select at least one launch item.");

    const stored = await db.execute({
      sql: "SELECT state_json FROM creative_os_state WHERE tenant_id = ? LIMIT 1",
      args: [tenantId],
    });
    const state = stored.rows[0]?.state_json
      ? (JSON.parse(String(stored.rows[0].state_json)) as CreativeOsState)
      : {};
    const contexts = requestedIds.map((id) => resolveLaunchContext(state, id));
    const first = contexts[0];
    const landingPageUrl = assertHttpUrl(
      clean(body.landingPageUrl || first.product?.url, 1200),
      "Landing page",
    );
    const cta = clean(body.cta || "LEARN_MORE", 80).toUpperCase() || "LEARN_MORE";

    const { token, adAccountId } = await getMetaToken(tenantId);
    const pageId = await resolvePageId(tenantId, token);
    const campaignMode = clean(body.campaignMode, 40) === "new" ? "new" : "existing";
    const adsetMode = clean(body.adsetMode, 40) === "new" ? "new" : "existing";
    const objective = objectiveForMeta(body.objective || "traffic");
    const startTime = parseMetaStartTime(body.startTime);
    const scheduledStartTime = adsetMode === "new" && isFutureMetaStartTime(startTime);
    const forceItemCopy = contexts.length > 1 || body.useItemCopy === true;
    const itemOverrides =
      body.itemOverrides && typeof body.itemOverrides === "object"
        ? (body.itemOverrides as Record<string, unknown>)
        : {};
    const preparedCreatives = [] as PreparedMetaAdCreative[];
    for (const context of contexts) {
      const override = itemOverrides[String(context.launchItem.id || "")];
      const itemCopy = override && typeof override === "object" ? (override as Record<string, unknown>) : {};
      preparedCreatives.push(
        await prepareMetaAdCreative({
          token,
          adAccountId,
          pageId,
          context,
          landingPageUrl,
          cta,
          adName: itemCopy.adName || body.adName,
          primaryText: itemCopy.primaryText || body.primaryText,
          headline: itemCopy.headline || body.headline,
          forceItemCopy,
        }),
      );
    }

    let campaignId = clean(body.campaignId, 120);
    if (campaignMode === "new") {
      const campaignName = clean(body.campaignName || `${first.product?.name || "Creative OS"} campaign`, 240);
      if (!campaignName) throw new Error("New campaign name is required.");
      const campaign = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/campaigns`, {
        method: "POST",
        body: JSON.stringify({
          name: campaignName,
          objective,
          status: scheduledStartTime ? "ACTIVE" : "PAUSED",
          special_ad_categories: [],
          buying_type: "AUCTION",
        }),
      });
      campaignId = String(campaign.id || "");
    }
    if (!campaignId) throw new Error("Choose an existing campaign or enter a new campaign name.");

    let adsetId = clean(body.adsetId, 120);
    if (adsetMode === "new") {
      const adsetName = clean(body.adsetName || first.task?.brief || first.launchItem.recommendedAdName, 240);
      if (!adsetName) throw new Error("New ad set name is required.");
      const template = await loadAdsetTemplate(token, clean(body.targetingSourceAdsetId, 120), campaignId);
      const targeting = buildTargeting(null, body.markets || "NL", { defaultCountries: ["NL"] });
      const campaignBudgetMode = clean(body.campaignBudgetMode, 40) === "campaign";
      const adsetBody: Record<string, unknown> = {
        name: adsetName,
        campaign_id: campaignId,
        status: scheduledStartTime ? "ACTIVE" : "PAUSED",
        targeting,
        ...adsetDefaultsForObjective(objective),
      };
      if (!campaignBudgetMode) {
        adsetBody.daily_budget = parseBudgetCents(body.dailyBudget, 2000);
      }
      if (startTime) adsetBody.start_time = startTime;
      applyAdsetTemplate(adsetBody, template);
      applyRegionalCompliance(adsetBody);
      if (adsetBody.optimization_goal === "OFFSITE_CONVERSIONS") {
        const pixelId = await firstPixelId(token, adAccountId);
        if (pixelId) {
          adsetBody.promoted_object = { pixel_id: pixelId, custom_event_type: "PURCHASE" };
        } else {
          adsetBody.optimization_goal = "LINK_CLICKS";
          delete adsetBody.promoted_object;
        }
      }
      const adset = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adsets`, {
        method: "POST",
        body: JSON.stringify(adsetBody),
      });
      adsetId = String(adset.id || "");
    }
    if (!adsetId) throw new Error("Choose an existing ad set or create a new one.");

    const created = [] as Array<Awaited<ReturnType<typeof createPausedMetaAd>>>;
    for (const prepared of preparedCreatives) {
      created.push(
        await createPausedMetaAd({
          token,
          adAccountId,
          adsetId,
          prepared,
          adStatus: scheduledStartTime ? "ACTIVE" : "PAUSED",
        }),
      );
    }

    const patchById = new Map(
      created.map((item) => [
        item.launchItemId,
        {
          ...item.patch,
          metaCampaignId: campaignId,
          metaAdsetId: adsetId,
        },
      ]),
    );
    const nextState: CreativeOsState = {
      ...state,
      launchItems: (state.launchItems || []).map((item) =>
        item.id && patchById.has(item.id) ? { ...item, ...patchById.get(item.id) } : item,
      ),
    };
    await db.execute({
      sql: `UPDATE creative_os_state SET state_json = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?`,
      args: [JSON.stringify(nextState), tenantId, tenantId],
    });

    for (const item of created) {
      await db.execute({
        sql: `INSERT INTO ad_audit_log (id, tenant_id, actor, action, entity_type, entity_id, after_json, reason)
              VALUES (lower(hex(randomblob(16))), ?, ?, 'creative_os_launch_to_meta', 'creative_os_launch_item', ?, ?, ?)`,
        args: [
          tenantId,
          tenantId,
          item.launchItemId,
          JSON.stringify({ ...patchById.get(item.launchItemId), mediaType: item.mediaType }),
          scheduledStartTime
            ? contexts.length > 1
              ? "Created scheduled Meta ad from Creative OS batch launch"
              : "Created scheduled Meta ad from Creative OS Launch"
            : contexts.length > 1
              ? "Created paused Meta ad from Creative OS batch launch"
              : "Created paused Meta ad from Creative OS Launch",
        ],
      });
    }

    const adIds = created.map((item) => String(item.patch.metaAdId || "")).filter(Boolean);
    return Response.json({
      ok: true,
      meta: {
        campaign_id: campaignId,
        adset_id: adsetId,
        ad_ids: adIds,
        ads_manager_url: adsManagerSelectedUrl(adAccountId, adIds),
        items: created.map((item) => ({
          launch_item_id: item.launchItemId,
          creative_id: item.patch.metaCreativeId,
          ad_id: item.patch.metaAdId,
          ads_manager_url: item.patch.metaLaunchUrl,
        })),
      },
      message:
        scheduledStartTime
          ? created.length === 1
            ? "Created scheduled ad in Meta Ads Manager."
            : `Created ${created.length} scheduled ads in Meta Ads Manager.`
          : created.length === 1
          ? "Created paused ad in Meta Ads Manager."
          : `Created ${created.length} paused ads in Meta Ads Manager.`,
    });
  } catch (err) {
    const message =
      err instanceof MetaError || err instanceof Error
        ? err.message
        : "Failed to create ad in Meta Ads Manager.";
    console.error("[Creative OS launch-to-meta]", err);
    return Response.json({ error: message }, { status: err instanceof MetaError ? err.status : 400 });
  }
}
