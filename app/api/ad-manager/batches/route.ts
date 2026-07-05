import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { createAdsetPlan, createBatch, createCopyVariant, createCreative, listBatches } from '@/lib/ad-manager/db';
import { creditErrorResponse, requireCredits, spendCredits } from '@/lib/credits';
import { getTenantConfig } from '@/lib/db';
import { persistContentStudioImageUrl } from '@/lib/r2-media';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await requireAuth(request);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    return Response.json({ batches: await listBatches(tenantId) });
  } catch (err) {
    console.error('[Ad Manager Batches]', err);
    return Response.json({ error: 'Failed to load batches' }, { status: 500 });
  }
}

function cleanId(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'draft';
}

function buildCopy(persona: any, item: any, index: number) {
  const productName = item?.name || 'this product';
  const angle = persona?.angle || `Show why ${productName} is worth trying`;
  const hook = persona?.hook || `Make ${productName} feel clear`;
  const primaryText = persona?.copy || `${angle}. See how ${productName} fits the next order.`;
  const safePrimary = String(primaryText).replace(/\byou\b/gi, 'customers').slice(0, 124);
  return {
    primaryText: safePrimary,
    headline: String(hook).slice(0, 40),
    cta: 'SHOP_NOW',
    overlay: persona?.overlay || hook,
    header: persona?.hook || String(hook).slice(0, 48),
    adKey: `${cleanId(persona?.id || 'persona')}-${index + 1}`,
  };
}


function normalizeTargetingJson(value: any) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildAdsetTargeting(persona: any, generationParams: any) {
  const copied = normalizeTargetingJson(generationParams.targeting_json);
  const template = generationParams.targeting_template || null;
  const hasCopiedTargeting = Object.keys(copied).length > 0;
  const fallback = {
    geo_locations: { countries: ['NL'] },
    age_min: 18,
    age_max: 65,
    flexible_spec: persona?.interests?.length ? [{ interests: persona.interests }] : [],
  };
  return {
    targeting: hasCopiedTargeting ? copied : fallback,
    targeting_source: hasCopiedTargeting ? 'copied_existing_adset' : 'persona_default',
    template_adset: template,
    review_required: true,
  };
}

function cleanText(value: unknown, max = 800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseJson(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function resolveAdImageModel(value: unknown) {
  const id = cleanText(value, 80);
  if (id === 'nano-banana' || id === 'google/nano-banana' || id === 'google/nano-banana-pro') {
    return { provider: 'google' as const, model: 'gemini-2.5-flash-image', label: 'Nano Banana' };
  }
  return { provider: 'openai' as const, model: 'gpt-image-2', label: 'ChatGPT Images' };
}

function dataUrlToInlinePart(dataUrl: unknown) {
  const raw = typeof dataUrl === 'string' ? dataUrl.trim() : '';
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

function productImageUrl(item: any, generationParams: any) {
  return cleanText(item?.imageUrl || item?.image_url || generationParams.reference_image_url || '', 1200);
}

function shortPromptSignals(prompt: string, productName: string) {
  const lower = prompt.toLowerCase();
  const signals: string[] = [];
  if (/\bdark|black|moody|night|shadow|low[-\s]?key\b/.test(lower)) {
    signals.push('Dark premium direction: black/charcoal wardrobe or background, controlled contrast, luxury shadows, bright product highlights.');
  }
  if (/\bmodel|person|wearing|neck|body|woman|man|female|male\b/.test(lower)) {
    signals.push('Use a real human model only when requested; natural skin texture, believable pose, product worn clearly, no plastic AI face.');
  }
  if (/\bchain|necklace|jewel|jewelry|jewellery|bracelet|ring|tennis\b/.test(`${lower} ${productName.toLowerCase()}`)) {
    signals.push('Jewelry direction: show the chain/jewelry as the hero, sharp metal/stones, close crop on neck/chest or macro detail, luxury e-commerce finish.');
  }
  if (/\bclean|minimal|simple|premium|luxury|luxe\b/.test(lower)) {
    signals.push('Minimal premium layout: one focal subject, restrained styling, no busy props, no collage.');
  }
  if (/\bugc|selfie|creator|tiktok\b/.test(lower)) {
    signals.push('Creator/UGC direction: real phone-shot energy but still polished, authentic hands and posture, no studio overproduction.');
  }
  if (/\bflatlay|flat lay|table|surface\b/.test(lower)) {
    signals.push('Flatlay direction: product on a clean surface with realistic shadows, tasteful props only if they support the product.');
  }
  return signals.length ? signals : ['Interpret the short prompt as a polished direct-response product ad, not a generic decorative image.'];
}

function buildImagePrompt(persona: any, item: any, copy: ReturnType<typeof buildCopy>, generationParams: any, brandProfile: any, provider: 'openai' | 'google') {
  const brandName = cleanText(generationParams.brand_name || generationParams.brand?.name || brandProfile?.brand_name || 'the brand', 120);
  const productName = cleanText(item?.name || generationParams.product_name || 'the selected product', 160);
  const productUrl = cleanText(item?.url || generationParams.product_folder_url || '', 1200);
  const productImage = productImageUrl(item, generationParams);
  const userPrompt = cleanText(generationParams.goal || generationParams.ad_idea || generationParams.hook || 'Create a product ad image', 1200);
  const feedback = cleanText(generationParams.iteration_feedback || '', 1000);
  const isRevision = Boolean(generationParams.revision_mode && feedback);
  const aspectRatio = cleanText(generationParams.creative_aspect_ratio || '4:5', 20);
  const visualStyle = cleanText(brandProfile?.visual_style || brandProfile?.brand_tone || 'clean, premium, modern ecommerce', 500);
  const colors = Array.isArray(brandProfile?.source_summary?.brand_colors) && brandProfile.source_summary.brand_colors.length
    ? brandProfile.source_summary.brand_colors.join(', ')
    : 'brand-matched neutral palette';
  const previousAssets = Array.isArray(generationParams.previous_staged_assets) ? generationParams.previous_staged_assets : [];
  const previousPrompt = cleanText(previousAssets[0]?.prompt || previousAssets[0]?.metadata?.image_generation?.prompt || '', 1200);
  const signals = shortPromptSignals(`${userPrompt} ${feedback}`, productName).map(signal => `- ${signal}`).join('\n');
  const providerHint = provider === 'google'
    ? 'Provider notes: optimized for Nano Banana / Gemini. Be literal, product-first and avoid decorative randomness.'
    : 'Provider notes: optimized for ChatGPT Images. Be literal, product-first and avoid decorative randomness.';

  return [
    providerHint,
    '',
    isRevision ? 'TASK: Create a revised replacement of the previous generated ad image. Keep the winning concept and product, apply only the requested changes.' : 'TASK: Create one high-converting Meta ad image from a short user prompt.',
    `USER PROMPT: "${userPrompt}"`,
    isRevision ? `REQUESTED CHANGES: "${feedback}"` : '',
    previousPrompt ? `PREVIOUS CREATIVE BRIEF TO PRESERVE WHERE USEFUL: ${previousPrompt}` : '',
    '',
    `Brand: ${brandName}`,
    `Product that must be visible: ${productName}`,
    productUrl ? `Product URL/context: ${productUrl}` : '',
    productImage ? `Reference product image URL: ${productImage}` : '',
    generationParams.reference_image_name ? `Uploaded reference name: ${cleanText(generationParams.reference_image_name, 160)}` : '',
    generationParams.campaign_name ? `Campaign: ${cleanText(generationParams.campaign_name, 160)}` : '',
    `Audience/persona: ${cleanText(persona?.name || 'target buyer', 120)}`,
    `Sales angle: ${cleanText(persona?.angle || copy.primaryText || userPrompt, 500)}`,
    `Brand style: ${visualStyle}`,
    `Brand colors: ${colors}`,
    '',
    'SHORT PROMPT EXPANSION:',
    signals,
    '',
    'CREATIVE RULES:',
    '- Single finished ad image. Do not make a collage, moodboard, grid, split layout, brochure, catalog page, or multi-panel design unless the user explicitly asks for that.',
    '- Product must be the hero and must match the selected product/category. Do not swap it for unrelated items.',
    '- If a model is requested, show the product naturally worn or held by the model. Crop can be face-free if it improves product focus.',
    '- Use realistic commercial photography or premium ecommerce render style. No surreal AI art, random props, fake UI, fake logos, or invented packaging.',
    '- Avoid long text. If any text appears, keep it tiny and optional; the image should still work with no readable text.',
    '- Strong thumb-stop composition for paid social: clear focal point, premium lighting, negative space, crisp product detail.',
    `- Format: ${aspectRatio} social ad crop, safe for Meta feed/story preview.`,
    '- No watermarks, malformed hands, extra fingers, distorted jewelry, warped typography, duplicated products, or obvious AI artifacts.',
  ].filter(Boolean).join('\n');
}

async function generateOpenAiAsset(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing, so AI image generation cannot run.');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size: '1024x1536',
      quality: 'high',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI image generation failed with ${response.status}`);
  }

  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;
  if (typeof url === 'string' && url) return { assetUrl: url, prompt, provider: 'openai', model: 'gpt-image-2' };
  if (typeof b64 === 'string' && b64) return { assetUrl: `data:image/png;base64,${b64}`, prompt, provider: 'openai', model: 'gpt-image-2' };
  throw new Error('OpenAI returned no image asset.');
}

async function generateGeminiAsset(prompt: string, generationParams: any) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY is missing, so Nano Banana image generation cannot run.');
  }

  const parts: any[] = [{ text: prompt }];
  const uploadedReference = dataUrlToInlinePart(generationParams.reference_image_data_url);
  if (uploadedReference) parts.push(uploadedReference);
  if (generationParams.revision_mode && Array.isArray(generationParams.previous_staged_assets)) {
    const previousImage = dataUrlToInlinePart(generationParams.previous_staged_assets[0]?.asset_url || generationParams.previous_staged_assets[0]?.final_asset_url);
    if (previousImage) parts.push(previousImage);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Nano Banana image generation failed');
  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) throw new Error('Nano Banana returned no image asset.');
  const mimeType = inline.mimeType || inline.mime_type || 'image/png';
  return { assetUrl: `data:${mimeType};base64,${inline.data}`, prompt, provider: 'google', model: 'gemini-2.5-flash-image' };
}

async function generateAiAsset(persona: any, item: any, copy: ReturnType<typeof buildCopy>, generationParams: any, brandProfile: any) {
  const model = resolveAdImageModel(generationParams.image_generation_model);
  const prompt = buildImagePrompt(persona, item, copy, generationParams, brandProfile, model.provider);
  if (model.provider === 'google') return generateGeminiAsset(prompt, generationParams);
  return generateOpenAiAsset(prompt);
}

export async function POST(request: NextRequest) {
  let body: any;
  let tenantId: string;
  try {
    body = await request.json();
    tenantId = await requireAuth(request, body.tenant_id);
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const generationParams = body.generation_params || { source: 'dashboard_draft' };
    const brandProfile = parseJson(await getTenantConfig(tenantId, 'brand_profile'));
    const items = Array.isArray(generationParams.selected_catalog_items) && generationParams.selected_catalog_items.length
      ? generationParams.selected_catalog_items
      : [{ id: body.product_id || 'catalog-item', name: generationParams.product_name || 'Selected product', url: generationParams.product_folder_url || '' }];
    const stagedAssets = Array.isArray(generationParams.staged_assets) ? generationParams.staged_assets : [];
    const isDriveSource = generationParams.content_source === 'drive';
    const isStagedAiSource = generationParams.content_source === 'staged_ai';
    const needsAiGeneration = !isDriveSource && !isStagedAiSource;
    const requestedCount = isStagedAiSource && stagedAssets.length
      ? stagedAssets.length
      : Math.min(Math.max(Number(generationParams.creative_count || 1), 1), 12);
    const personaSuggestions = Array.isArray(generationParams.persona_suggestions) && generationParams.persona_suggestions.length
      ? generationParams.persona_suggestions
      : [generationParams.persona || {}];
    const formats = Array.isArray(body.requested_formats) && body.requested_formats.length ? body.requested_formats : ['feed_4x5'];

    if ((body.stage_only || body.auto_create_package) && needsAiGeneration && !process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'AI image generation is not configured yet. Connect OpenAI or use Drive content.' }, { status: 400 });
    }

    if (body.stage_only) {
      if (!needsAiGeneration) {
        return Response.json({ error: 'Preview generation needs AI image generation. Save existing assets from the review step instead.' }, { status: 400 });
      }
      await requireCredits(tenantId, 'ai_creative', requestedCount);
      const stagedCreatives = [];
      for (let index = 0; index < requestedCount; index += 1) {
        const item = items[index % items.length] || items[0];
        const persona = personaSuggestions[index % personaSuggestions.length] || {};
        const copy = buildCopy(persona, item, index);
        const aiAsset = await generateAiAsset(persona, item, copy, generationParams, brandProfile);
        const persistedUrl = await persistContentStudioImageUrl(
          aiAsset.assetUrl,
          `logic-ads/${tenantId}/staged`,
        );
        const finalUrl = persistedUrl || aiAsset.assetUrl;
        stagedCreatives.push({
          id: `staged-${Date.now()}-${index + 1}`,
          asset_url: finalUrl,
          final_asset_url: finalUrl,
          format: formats[index % formats.length] || 'feed_4x5',
          media_type: 'image',
          source: 'staged_ai',
          product_id: String(item.id || body.product_id || ''),
          product_name: item.name || generationParams.product_name || 'Selected product',
          persona_id: persona?.id || `persona-${index + 1}`,
          persona_name: persona?.name || 'Persona',
          title: `${item.name || 'Product'} - ${persona?.name || 'Persona'} ${index + 1}`,
          metadata: {
            title: `${item.name || 'Product'} - ${persona?.name || 'Persona'} ${index + 1}`,
            persona,
            overlay: copy.overlay,
            hook: persona?.hook || generationParams.hook || copy.headline,
            header: copy.header,
            goal: generationParams.goal,
            image_generation: { provider: aiAsset.provider, model: aiAsset.model, prompt: aiAsset.prompt },
          },
          copy: {
            primaryText: copy.primaryText,
            headline: copy.headline,
            cta: copy.cta,
          },
          source_asset_refs: {
            content_source: 'staged_ai',
            product: item,
            ai_image_provider: aiAsset.provider,
            ai_image_model: aiAsset.model,
          },
        });
      }
      if (stagedCreatives.length) {
        await spendCredits(tenantId, 'ai_creative', stagedCreatives.length, `Generate ${stagedCreatives.length} AI ad preview${stagedCreatives.length === 1 ? '' : 's'}`, { stage_only: true });
      }
      return Response.json({ staged_creatives: stagedCreatives, credits_spent: stagedCreatives.length });
    }

    const batch = await createBatch(tenantId, {
      name: body.name || 'Draft creative batch',
      productId: body.product_id || null,
      requestedFormats: body.requested_formats || ['feed', 'story'],
      personaIds: body.persona_ids || [],
      hookIds: body.hook_ids || [],
      templateIds: body.template_ids || [],
      generationParams,
      createdBy: body.actor || tenantId,
    });

    if (!body.auto_create_package) return Response.json({ batch });

    const batchId = String(batch?.id || '');
    if (needsAiGeneration) {
      await requireCredits(tenantId, 'ai_creative', requestedCount);
    }
    const creatives = [];
    const adsets = [];

    for (let index = 0; index < requestedCount; index += 1) {
      const item = items[index % items.length] || items[0];
      const persona = personaSuggestions[index % personaSuggestions.length] || {};
      const copy = buildCopy(persona, item, index);
      const stagedAsset = isStagedAiSource ? stagedAssets[index] : null;
      const aiAsset = needsAiGeneration
        ? await generateAiAsset(persona, item, copy, generationParams, brandProfile)
        : null;
      const driveAsset = isDriveSource
        ? (item?.imageUrl || item?.image_url || item?.drive?.url || null)
        : null;
      const stagedCopy = stagedAsset?.copy || {};
      const finalCopy = {
        primaryText: stagedCopy.primaryText || stagedCopy.primary_text || copy.primaryText,
        headline: stagedCopy.headline || copy.headline,
        cta: stagedCopy.cta || copy.cta,
      };
      let rawAssetUrl = stagedAsset?.final_asset_url || stagedAsset?.asset_url || aiAsset?.assetUrl || driveAsset || null;
      if (rawAssetUrl && (rawAssetUrl.startsWith('data:') || rawAssetUrl.includes('openai') || rawAssetUrl.includes('oaidalleapiprodscus') || rawAssetUrl.includes('google') || rawAssetUrl.includes('generative'))) {
        const persisted = await persistContentStudioImageUrl(rawAssetUrl, `logic-ads/${tenantId}/creatives`);
        if (persisted) {
          rawAssetUrl = persisted;
        }
      }
      const creative = await createCreative(tenantId, {
        batchId,
        productId: String(stagedAsset?.product_id || item.id || body.product_id || ''),
        personaId: stagedAsset?.persona_id || persona?.id || `persona-${index + 1}`,
        hookId: copy.adKey,
        format: stagedAsset?.format || formats[index % formats.length] || 'feed_4x5',
        mediaType: isDriveSource ? 'mixed' : 'image',
        assetUrl: rawAssetUrl,
        finalAssetUrl: rawAssetUrl,
        sourceAssetRefs: {
          content_source: generationParams.content_source || 'ai',
          product: item,
          drive: item.drive || generationParams.available_assets || null,
          staged_asset: stagedAsset ? { ...stagedAsset, asset_url: rawAssetUrl, final_asset_url: rawAssetUrl } : null,
          drive_required: isDriveSource,
          ai_generation_required: needsAiGeneration,
          ai_image_provider: aiAsset?.provider || stagedAsset?.metadata?.image_generation?.provider || (needsAiGeneration ? 'openai' : null),
          ai_image_model: aiAsset?.model || stagedAsset?.metadata?.image_generation?.model || (needsAiGeneration ? 'gpt-image-2' : null),
          generation_inputs: needsAiGeneration ? { brand_data: true, product_url: item.url || null, product_image: item.imageUrl || item.image_url || null, campaign_context: generationParams.campaign_name || null } : null,
        },
        metadata: {
          ...(stagedAsset?.metadata || {}),
          title: stagedAsset?.title || stagedAsset?.metadata?.title || `${item.name || 'Product'} - ${persona?.name || 'Persona'} ${index + 1}`,
          persona: stagedAsset?.metadata?.persona || persona,
          overlay: stagedAsset?.metadata?.overlay || copy.overlay,
          hook: stagedAsset?.metadata?.hook || persona?.hook || generationParams.hook || finalCopy.headline,
          header: stagedAsset?.metadata?.header || copy.header,
          campaign: { mode: generationParams.campaign_mode, id: generationParams.campaign_id, name: generationParams.campaign_name },
          goal: generationParams.goal,
          adset_rule: 'One persona equals one ad set',
          image_generation: aiAsset ? { provider: aiAsset.provider, model: aiAsset.model, prompt: aiAsset.prompt } : stagedAsset?.metadata?.image_generation || null,
        },
        actor: body.actor || tenantId,
      });
      creatives.push(creative);
      if (creative?.id) {
        await createCopyVariant(tenantId, {
          creativeId: String(creative.id),
          primaryText: finalCopy.primaryText,
          headline: finalCopy.headline,
          cta: finalCopy.cta,
          selected: true,
        });
        adsets.push({
          key: `adset_${copy.adKey}`,
          name: `${persona?.name || 'Persona'} - ${item.name || 'Product'} ${index + 1}`,
          status: 'draft_review',
          source: generationParams.content_source || 'ai',
          persona_id: persona?.id || null,
          product_id: item.id || null,
          campaign_context: generationParams.campaign_name || null,
          rule: 'one_persona_one_adset',
          ...buildAdsetTargeting(persona, generationParams),
          ads: [{ ad_key: `ad_${copy.adKey}`, creative_id: String(creative.id), headline: finalCopy.headline, cta: finalCopy.cta, header: copy.header, primary_text: finalCopy.primaryText, overlay: copy.overlay }],
        });
      }
    }

    const plan = await createAdsetPlan(tenantId, {
      batchId,
      name: `${generationParams.campaign_name || 'Campaign'} adset draft - ${new Date().toISOString().slice(0, 10)}`,
      planJson: {
        campaign: generationParams.campaign_mode === 'new' ? generationParams.new_campaign : { id: generationParams.campaign_id, name: generationParams.campaign_name },
        content_source: generationParams.content_source || 'ai',
        review_required: true,
        live_publish_blocked_until_review: true,
        targeting_source: generationParams.targeting_source || (generationParams.targeting_json ? 'copied_existing_adset' : 'persona_default'),
        targeting_template_adset: generationParams.targeting_template || null,
        adsets,
      },
      reasoning: 'Runnable ad sets created from selected campaign, catalog, content source and persona. Review and approval gates protect the final run step.',
      createdBy: body.actor || tenantId,
    });

    if (needsAiGeneration && creatives.length) {
      await spendCredits(tenantId, 'ai_creative', creatives.length, `Create ${creatives.length} AI ad creative${creatives.length === 1 ? '' : 's'}`, { batch_id: batchId });
    }

    return Response.json({ batch, creatives, plan });
  } catch (err) {
    const creditResponse = creditErrorResponse(err);
    if (creditResponse) return creditResponse;
    console.error('[Ad Manager Create Batch]', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to create batch' }, { status: 500 });
  }
}
