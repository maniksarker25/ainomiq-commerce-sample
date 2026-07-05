export type ContentImageProvider = 'openai' | 'google';

export type ContentImageModel = {
  id: string;
  provider: ContentImageProvider;
  providerLabel: string;
  label: string;
  description: string;
  providerModel: string;
  baseCredits: number;
  marginMultiplier: number;
  billableCredits: number;
};

export const IMAGE_MARGIN_MULTIPLIER = 1.25;

function priced(model: Omit<ContentImageModel, 'marginMultiplier' | 'billableCredits'>): ContentImageModel {
  const billableCredits = Number((model.baseCredits * IMAGE_MARGIN_MULTIPLIER).toFixed(2));
  return { ...model, marginMultiplier: IMAGE_MARGIN_MULTIPLIER, billableCredits };
}

export const CONTENT_IMAGE_MODELS: ContentImageModel[] = [
  priced({
    id: 'openai/gpt-image-2',
    provider: 'openai',
    providerLabel: 'ChatGPT Images',
    label: 'ChatGPT Images Standard',
    description: 'Best default for daily product and campaign visuals.',
    providerModel: 'gpt-image-2',
    baseCredits: 1,
  }),
  priced({
    id: 'openai/gpt-image-2-high',
    provider: 'openai',
    providerLabel: 'ChatGPT Images',
    label: 'ChatGPT Images High Quality',
    description: 'Higher detail for ads, hero visuals, and polished product shots.',
    providerModel: 'gpt-image-2',
    baseCredits: 2,
  }),
  priced({
    id: 'google/nano-banana',
    provider: 'google',
    providerLabel: 'Google Gemini',
    label: 'Nano Banana Standard',
    description: 'Fast Gemini image generation for concepts, social visuals, and variations.',
    providerModel: 'gemini-2.5-flash-image',
    baseCredits: 1,
  }),
  priced({
    id: 'google/nano-banana-pro',
    provider: 'google',
    providerLabel: 'Google Gemini',
    label: 'Nano Banana Pro',
    description: 'Higher quality Gemini image generation for polished campaign assets.',
    providerModel: 'gemini-2.5-flash-image',
    baseCredits: 2,
  }),
];

export function getContentImageModel(id: unknown) {
  const value = typeof id === 'string' ? id.trim() : '';
  return CONTENT_IMAGE_MODELS.find(model => model.id === value) || CONTENT_IMAGE_MODELS[0];
}

/** Primary API for image generation (matches Logic Ads `resolveAdImageModel` routing). */
export function primaryImageProviderForContentModel(modelId: unknown): ContentImageProvider {
  return getContentImageModel(modelId).provider;
}

export function contentImageModelMap() {
  return Object.fromEntries(CONTENT_IMAGE_MODELS.map(model => [model.id, model]));
}
