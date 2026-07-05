import { NextRequest } from 'next/server';
import { requireAuth, handleAuthError } from '@/lib/auth-guard';
import { deleteTenantConfig, getTenantConfig, setTenantConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
const BRAND_PROFILE_KEY = 'brand_profile';

type BrandProfileInput = {
  brand_name?: string;
  website?: string;
  what_you_sell?: string;
  ideal_customer?: string;
  customer_problem?: string;
  main_offer?: string;
  proof_points?: string;
  competitors?: string;
  brand_purpose?: string;
  brand_tone?: string;
  visual_style?: string;
  content_goals?: string;
  logo_url?: string;
  icon_url?: string;
  full_logo_url?: string;
  source_summary?: any;
  analysis?: any;
};

function clean(value: any, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function cleanBrandProfile(input: BrandProfileInput, existing?: any) {
  const now = new Date().toISOString();
  const profile = {
    brand_name: clean(input.brand_name, 120),
    website: clean(input.website, 500),
    what_you_sell: clean(input.what_you_sell, 1500),
    ideal_customer: clean(input.ideal_customer, 1500),
    customer_problem: clean(input.customer_problem, 1500),
    main_offer: clean(input.main_offer, 1500),
    proof_points: clean(input.proof_points, 1500),
    competitors: clean(input.competitors, 1000),
    brand_purpose: clean(input.brand_purpose, 1200),
    brand_tone: clean(input.brand_tone, 1200),
    visual_style: clean(input.visual_style, 1200),
    content_goals: clean(input.content_goals, 1200),
    logo_url: clean(input.logo_url, 50000),
    icon_url: clean(input.icon_url, 50000),
    full_logo_url: clean(input.full_logo_url, 50000),
    source_summary: input.source_summary && typeof input.source_summary === 'object' ? input.source_summary : existing?.source_summary || null,
    analysis: input.analysis && typeof input.analysis === 'object' ? input.analysis : existing?.analysis || null,
    status: clean(input.brand_name || existing?.brand_name, 120) || input.source_summary || existing?.source_summary ? 'ready' : 'draft',
    updated_at: now,
  };
  return profile;
}

export async function GET(request: NextRequest) {
  let tenantId = '';
  try { tenantId = await requireAuth(request, request.nextUrl.searchParams.get('tenant_id') || undefined); } catch (err) { return handleAuthError(err); }
  const raw = await getTenantConfig(tenantId, BRAND_PROFILE_KEY);
  if (!raw) return Response.json({ profile: null });
  try { return Response.json({ profile: JSON.parse(raw) }); } catch { return Response.json({ profile: null }); }
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  let tenantId = '';
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleAuthError(err); }
  const existingRaw = await getTenantConfig(tenantId, BRAND_PROFILE_KEY);
  let existing: any = null;
  try { existing = existingRaw ? JSON.parse(existingRaw) : null; } catch {}
  const profile = cleanBrandProfile(body, existing);
  await setTenantConfig(tenantId, BRAND_PROFILE_KEY, JSON.stringify(profile));
  return Response.json({ ok: true, profile });
}

export async function DELETE(request: NextRequest) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  let tenantId = '';
  try { tenantId = await requireAuth(request, body.tenant_id); } catch (err) { return handleAuthError(err); }
  await deleteTenantConfig(tenantId, BRAND_PROFILE_KEY);
  return Response.json({ ok: true, profile: null });
}
