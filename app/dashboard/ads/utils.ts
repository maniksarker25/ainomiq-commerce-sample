import { ProductFolder, DbRow } from './types';

export function nomiText(value: unknown) {
  return String(value || '')
    .replace(/\bcredits\b/gi, "Nomi's")
    .replace(/\bcredit\b/gi, 'Nomi');
}

export function readableTemplateTextColor(background: string) {
  if (!background || background === 'transparent') return '#111827';
  const hex = background.trim();
  const hexMatch = hex.match(/^#?([0-9a-f]{6})$/i);
  const rgbMatch = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  const rgb = hexMatch
    ? [parseInt(hexMatch[1].slice(0, 2), 16), parseInt(hexMatch[1].slice(2, 4), 16), parseInt(hexMatch[1].slice(4, 6), 16)]
    : rgbMatch
      ? [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
      : [255, 255, 255];
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return luminance > 0.58 ? '#111827' : '#ffffff';
}

export function clientSlug(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function productMatchKeys(item: Partial<ProductFolder> | null | undefined) {
  if (!item) return [] as string[];
  return [item.id, item.name, item.url].map(clientSlug).filter(Boolean);
}

export function safePersonaRules(value: unknown) {
  if (!value || typeof value !== 'string') return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {} as Record<string, string>;
  }
}

export function createChatSessionId(tenantId: string) {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `logic-ads:${tenantId || 'anonymous'}:${randomPart}`;
}

export function getAmsterdamDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function sanitizeChatText(value: unknown) {
  return String(value || '')
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/gi, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function safeStoredMessages(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const messages = parsed
      .filter((item: any) => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.text === 'string')
      .map((item: any) => ({ ...item, text: sanitizeChatText(item.text).slice(0, 4000) }))
      .slice(-80);
    return messages.length ? messages : null;
  } catch {
    return null;
  }
}

export function formatTemplateSummary(template: DbRow) {
  const kind = String(template.kind || '').toLowerCase();
  const rawFormats = Array.isArray(template.format_support)
    ? template.format_support
    : typeof template.format_support === 'string'
      ? template.format_support.replace(/\[/g, '').replace(/\]/g, '').replace(/"/g, '').replace(/'/g, '').split(',').map(item => item.trim()).filter(Boolean)
      : [];
  const mediaTypes = new Set<string>();
  for (const item of rawFormats) {
    const value = String(item).toLowerCase();
    if (value.includes('photo')) mediaTypes.add('Photo');
    if (value.includes('video')) mediaTypes.add('Video');
  }
  if (!mediaTypes.size) {
    if (kind.includes('video')) mediaTypes.add('Video');
    if (kind.includes('photo') || !mediaTypes.size) mediaTypes.add('Photo');
  }
  const ratioMatch = rawFormats.map(item => String(item).toLowerCase()).join(' ').match(/(\d+)x(\d+)/);
  const ratio = ratioMatch ? `${ratioMatch[1]}:${ratioMatch[2]}` : '';
  const typeLabel = ['Photo', 'Video'].filter(type => mediaTypes.has(type)).join(' + ');
  return ratio ? `${typeLabel} - ${ratio}` : typeLabel;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}

export function parseDbJson(value: unknown) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseAssetTags(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
    } catch {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function apiPost<T = any>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok && !data.gate) {
    const error = new Error(data.error || 'Request failed') as Error & { data?: unknown; status?: number };
    error.data = data;
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function apiDelete<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
