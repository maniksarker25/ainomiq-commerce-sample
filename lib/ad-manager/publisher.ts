import { db } from '@/lib/db';
import { getMetaToken, metaFetch } from '@/lib/meta';
import { getAdsetPlan, logAdManagerAudit } from './db';
import { resolveFacebookPage } from '@/lib/cs-social';
import {
  adsetDefaultsForObjective,
  conversionPromotedObject,
  objectiveForMeta,
  resolveAdsetTargeting,
  type TemplateAdset,
} from './meta-adset-defaults';

type CopyVariant = {
  primary_text: string;
  headline: string;
  cta: string;
};

type Destination = {
  final_url: string;
};

type CreativeRow = {
  id: string;
  tenant_id: string;
  batch_id: string;
  product_id: string | null;
  persona_id: string | null;
  hook_id: string | null;
  template_id: string | null;
  format: string;
  media_type: string;
  asset_url: string | null;
  local_asset_path: string | null;
  source_asset_refs: string | null;
  status: string;
  qc_status: string | null;
  final_asset_url: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

export async function publishJobToMeta(tenantId: string, jobId: string) {
  // Update job status to publishing
  await db.execute({
    sql: `UPDATE ad_publish_jobs SET status = 'publishing', started_at = datetime('now'), updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
    args: [tenantId, jobId],
  });

  const itemsResult = await db.execute({
    sql: `SELECT * FROM ad_publish_items WHERE tenant_id = ? AND publish_job_id = ?`,
    args: [tenantId, jobId],
  });
  const items = itemsResult.rows;

  if (items.length === 0) {
    await db.execute({
      sql: `UPDATE ad_publish_jobs SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
      args: [tenantId, jobId],
    });
    return { success: true, message: 'No items to publish.' };
  }

  try {
    const { token, adAccountId } = await getMetaToken(tenantId);

    // Resolve Page ID
    let pageId = '';
    const fbPage = await resolveFacebookPage(tenantId);
    if (fbPage?.pageId) {
      pageId = fbPage.pageId;
    } else {
      const pageAccounts = await metaFetch(token, '/me/accounts?fields=id,name&limit=50');
      if (pageAccounts && Array.isArray(pageAccounts.data) && pageAccounts.data.length > 0) {
        pageId = String(pageAccounts.data[0].id);
      }
    }

    if (!pageId) {
      throw new Error('A connected Facebook Page is required to publish ads. Please connect one in settings.');
    }

    // Resolve Pixel ID
    let pixelId: string | null = null;
    try {
      const pixelsData = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adspixels?fields=id,name&limit=5`);
      if (pixelsData && Array.isArray(pixelsData.data) && pixelsData.data.length > 0) {
        pixelId = String(pixelsData.data[0].id);
      }
    } catch (err) {
      console.error('[Publisher] Pixel lookup failed, continuing without pixel:', err);
    }

    // Load publish job details
    const jobResult = await db.execute({
      sql: `SELECT plan_id FROM ad_publish_jobs WHERE tenant_id = ? AND id = ?`,
      args: [tenantId, jobId],
    });
    const planId = String(jobResult.rows[0]?.plan_id || '');
    const plan = await getAdsetPlan(tenantId, planId);
    if (!plan) {
      throw new Error('Associated plan not found for this publish job.');
    }

    let planJson: any = {};
    try {
      planJson = JSON.parse(String(plan.plan_json || '{}'));
    } catch {
      throw new Error('Invalid plan JSON format.');
    }

    // Idempotent Campaign lookup/creation
    let metaCampaignId = '';
    const campaignMode = planJson.campaign?.mode || 'existing';
    const campaignName = planJson.campaign?.name || 'Logic Ads Campaign';
    const resolvedCampaignId = planJson.campaign?.id || '';

    if (campaignMode === 'new') {
      // Check if campaign already created for this job
      const campaignCheck = await db.execute({
        sql: `SELECT meta_campaign_id FROM ad_publish_items WHERE tenant_id = ? AND publish_job_id = ? AND meta_campaign_id IS NOT NULL LIMIT 1`,
        args: [tenantId, jobId],
      });
      if (campaignCheck.rows.length > 0 && campaignCheck.rows[0].meta_campaign_id) {
        metaCampaignId = String(campaignCheck.rows[0].meta_campaign_id);
      } else {
        const isCbo = planJson.budget_level === 'campaign';
        const objective = objectiveForMeta(planJson.campaign?.objective);
        const campaignBody: Record<string, any> = {
          name: campaignName,
          objective,
          status: 'PAUSED',
          special_ad_categories: [],
          buying_type: 'AUCTION',
        };
        if (isCbo && planJson.campaign?.daily_budget) {
          campaignBody.daily_budget = planJson.campaign.daily_budget;
        }

        const createdCampaign = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/campaigns`, {
          method: 'POST',
          body: JSON.stringify(campaignBody),
        });
        metaCampaignId = String(createdCampaign.id);
      }
    } else {
      metaCampaignId = resolvedCampaignId;
    }

    if (!metaCampaignId) {
      throw new Error('Meta Campaign ID could not be resolved.');
    }

    const adsetMap = new Map<string, string>();

    // Process each item
    for (const item of items) {
      if (item.status === 'completed') {
        continue;
      }

      const itemId = String(item.id);
      const creativeId = String(item.creative_id);
      const adsetKey = String(item.adset_key || '');

      await db.execute({
        sql: `UPDATE ad_publish_items SET status = 'publishing', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
        args: [tenantId, itemId],
      });

      try {
        // Fetch Creative
        const creativeResult = await db.execute({
          sql: `SELECT * FROM ad_creatives WHERE tenant_id = ? AND id = ?`,
          args: [tenantId, creativeId],
        });
        const creative = creativeResult.rows[0] as unknown as CreativeRow | undefined;
        if (!creative) {
          throw new Error(`Creative ${creativeId} not found.`);
        }

        // Fetch Selected Copy Variant
        const copyResult = await db.execute({
          sql: `SELECT primary_text, headline, cta FROM ad_copy_variants WHERE tenant_id = ? AND creative_id = ? AND selected = 1 LIMIT 1`,
          args: [tenantId, creativeId],
        });
        const copyVariant = copyResult.rows[0] as unknown as CopyVariant | undefined;
        if (!copyVariant) {
          throw new Error(`No selected copywriting found for creative ${creativeId}.`);
        }

        // Fetch Valid Destination URL
        const destResult = await db.execute({
          sql: `SELECT final_url FROM ad_destinations WHERE tenant_id = ? AND creative_id = ? AND valid = 1 LIMIT 1`,
          args: [tenantId, creativeId],
        });
        const destination = destResult.rows[0] as unknown as Destination | undefined;
        if (!destination) {
          throw new Error(`No valid destination URL found for creative ${creativeId}.`);
        }

        // Upload Media Image
        let imageHash = creative.final_asset_url || '';
        // If imageHash is not a Meta hex hash (usually 32 chars), upload it
        const isMetaHash = /^[a-fA-F0-9]{32}$/.test(imageHash);

        if (!imageHash || !isMetaHash) {
          const assetUrl = creative.final_asset_url || creative.asset_url;
          if (!assetUrl) {
            throw new Error(`Creative asset URL is missing for ${creativeId}.`);
          }

          let blob: Blob;
          if (assetUrl.startsWith('data:')) {
            const match = assetUrl.match(/^data:([^;,]+);base64,(.+)$/);
            if (!match) throw new Error('Invalid base64 data URL format');
            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            blob = new Blob([buffer], { type: mimeType });
          } else {
            const imageRes = await fetch(assetUrl);
            if (!imageRes.ok) throw new Error(`Failed to fetch image from URL: ${assetUrl}`);
            const buffer = await imageRes.arrayBuffer();
            blob = new Blob([buffer], { type: imageRes.headers.get('content-type') || 'image/png' });
          }

          const formData = new FormData();
          formData.append('file', blob, `creative_${creativeId}.png`);

          const uploadRes = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId.replace('act_', '')}/adimages?access_token=${token}`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Meta AdImage upload failed: ${errText}`);
          }

          const uploadData = await uploadRes.json();
          const imageDetails = Object.values(uploadData.images || {})[0] as any;
          if (!imageDetails?.hash) {
            throw new Error('Meta did not return an image hash.');
          }
          imageHash = imageDetails.hash;

          // Update image hash in the DB
          await db.execute({
            sql: `UPDATE ad_creatives SET final_asset_url = ?, status = 'upload_ready', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
            args: [imageHash, tenantId, creativeId],
          });
        }

        // Idempotent Ad Set lookup/creation
        let metaAdsetId = adsetMap.get(adsetKey) || '';
        if (!metaAdsetId && adsetKey) {
          // Check sibling items
          const siblingCheck = await db.execute({
            sql: `SELECT meta_adset_id FROM ad_publish_items WHERE tenant_id = ? AND publish_job_id = ? AND adset_key = ? AND meta_adset_id IS NOT NULL LIMIT 1`,
            args: [tenantId, jobId, adsetKey],
          });
          if (siblingCheck.rows.length > 0 && siblingCheck.rows[0].meta_adset_id) {
            metaAdsetId = String(siblingCheck.rows[0].meta_adset_id);
            adsetMap.set(adsetKey, metaAdsetId);
          }
        }

        if (!metaAdsetId && adsetKey) {
          const adsetConfig = planJson.adsets?.find((a: any) => a.key === adsetKey || a.adset_key === adsetKey);
          if (!adsetConfig) {
            throw new Error(`Adset key ${adsetKey} config not found in plan.`);
          }

          const targeting = resolveAdsetTargeting(planJson, adsetConfig);
          const dailyBudget = adsetConfig.daily_budget || adsetConfig.targeting?.daily_budget || 2000;
          const objective = objectiveForMeta(planJson.campaign?.objective);
          const deliveryTemplate = (planJson.targeting_template_adset || null) as TemplateAdset | null;
          const adsetDefaults = adsetDefaultsForObjective(objective, deliveryTemplate);

          const adsetBody: Record<string, any> = {
            name: adsetConfig.name || `Ad Set - ${adsetKey}`,
            campaign_id: metaCampaignId,
            status: 'PAUSED',
            targeting,
            ...adsetDefaults,
          };

          const promotedFromPixel = pixelId
            ? conversionPromotedObject(pixelId, adsetBody.optimization_goal)
            : null;
          if (promotedFromPixel && !adsetBody.promoted_object) {
            adsetBody.promoted_object = promotedFromPixel;
          }

          const isCbo = planJson.budget_level === 'campaign';
          if (!isCbo) {
            adsetBody.daily_budget = dailyBudget;
          }

          const createdAdset = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adsets`, {
            method: 'POST',
            body: JSON.stringify(adsetBody),
          });
          metaAdsetId = String(createdAdset.id);
          adsetMap.set(adsetKey, metaAdsetId);
        }

        // Create Ad Creative
        const creativeName = creative.metadata ? (JSON.parse(creative.metadata).title || `Creative ${creativeId}`) : `Creative ${creativeId}`;
        const creativeBody = {
          name: creativeName,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              image_hash: imageHash,
              link: destination.final_url,
              message: copyVariant.primary_text,
              name: copyVariant.headline,
              call_to_action: {
                type: copyVariant.cta,
                value: {
                  link: destination.final_url,
                },
              },
            },
          },
        };

        const createdCreativeResponse = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/adcreatives`, {
          method: 'POST',
          body: JSON.stringify(creativeBody),
        });
        const metaCreativeId = String(createdCreativeResponse.id);

        // Create Ad
        const adName = copyVariant.headline || `Ad - ${creativeName}`;
        const adBody = {
          name: adName,
          adset_id: metaAdsetId,
          creative: {
            creative_id: metaCreativeId,
          },
          status: 'PAUSED',
        };

        const createdAdResponse = await metaFetch(token, `/${encodeURIComponent(adAccountId)}/ads`, {
          method: 'POST',
          body: JSON.stringify(adBody),
        });
        const metaAdId = String(createdAdResponse.id);

        // Update item status in DB
        await db.execute({
          sql: `UPDATE ad_publish_items 
                SET status = 'completed', meta_campaign_id = ?, meta_adset_id = ?, meta_ad_id = ?, admanage_asset_id = ?, admanage_result_json = ?, updated_at = datetime('now')
                WHERE tenant_id = ? AND id = ?`,
          args: [metaCampaignId, metaAdsetId, metaAdId, imageHash, JSON.stringify({ metaCreativeId, createdAdResponse }), tenantId, itemId],
        });
      } catch (itemErr: any) {
        console.error(`[Publisher] Failed item ${itemId}:`, itemErr);
        const errMsg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        await db.execute({
          sql: `UPDATE ad_publish_items SET status = 'failed', error = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
          args: [errMsg.slice(0, 500), tenantId, itemId],
        });
      }
    }

    // Finalize the job status
    const statusCounts = await db.execute({
      sql: `SELECT status, COUNT(*) as count FROM ad_publish_items WHERE tenant_id = ? AND publish_job_id = ? GROUP BY status`,
      args: [tenantId, jobId],
    });
    let failedCount = 0;
    let completedCount = 0;
    for (const row of statusCounts.rows) {
      const status = String(row.status || '');
      const count = Number(row.count || 0);
      if (status === 'failed') failedCount = count;
      if (status === 'completed') completedCount = count;
    }

    if (failedCount === 0) {
      await db.execute({
        sql: `UPDATE ad_publish_jobs SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now'), error = null WHERE tenant_id = ? AND id = ?`,
        args: [tenantId, jobId],
      });
      await logAdManagerAudit({
        tenantId,
        actor: 'publisher',
        action: 'publish_job_completed',
        entityType: 'ad_publish_job',
        entityId: jobId,
      });
      return { success: true, message: 'All items published successfully.' };
    }

    const partial = completedCount > 0;
    const jobStatus = partial ? 'partial' : 'failed';
    const jobError = partial
      ? `${completedCount} ad${completedCount === 1 ? '' : 's'} published, ${failedCount} failed. Expand this job to see which ads landed in Meta.`
      : 'One or more items failed to publish';

    await db.execute({
      sql: `UPDATE ad_publish_jobs SET status = ?, completed_at = datetime('now'), updated_at = datetime('now'), error = ? WHERE tenant_id = ? AND id = ?`,
      args: [jobStatus, jobError, tenantId, jobId],
    });
    await logAdManagerAudit({
      tenantId,
      actor: 'publisher',
      action: partial ? 'publish_job_partial' : 'publish_job_failed',
      entityType: 'ad_publish_job',
      entityId: jobId,
      reason: jobError,
    });
    return {
      success: false,
      partial,
      completedCount,
      failedCount,
      message: jobError,
    };
  } catch (jobErr: any) {
    console.error(`[Publisher] Failed job ${jobId}:`, jobErr);
    const jobErrMsg = jobErr instanceof Error ? jobErr.message : String(jobErr);
    await db.execute({
      sql: `UPDATE ad_publish_jobs SET status = 'failed', completed_at = datetime('now'), updated_at = datetime('now'), error = ? WHERE tenant_id = ? AND id = ?`,
      args: [jobErrMsg.slice(0, 500), tenantId, jobId],
    });
    await db.execute({
      sql: `UPDATE ad_publish_items SET status = 'failed', error = ?, updated_at = datetime('now') WHERE tenant_id = ? AND publish_job_id = ? AND status IN ('queued', 'publishing')`,
      args: [jobErrMsg.slice(0, 500), tenantId, jobId],
    });
    await logAdManagerAudit({
      tenantId,
      actor: 'publisher',
      action: 'publish_job_exception',
      entityType: 'ad_publish_job',
      entityId: jobId,
      reason: jobErrMsg,
    });
    return { success: false, error: jobErrMsg };
  }
}
