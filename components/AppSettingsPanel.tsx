'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAppDefinition, getDefaultAppSettings, type AppIntegrationId, type AppSettings } from '@/lib/app-settings';
import { fetchSession, getSession, type Session } from '@/lib/session';

type IntegrationInput = {
  provider: string;
  label: string;
  href?: string;
  required?: boolean;
};

type Props = {
  appName?: string;
  title?: string;
  settingsName?: string;
  appKey?: string;
  appId?: string;
  tenantId?: string;
  directory?: string;
  description?: string;
  setupHref?: string;
  settingsHref?: string;
  integrations?: IntegrationInput[];
  compact?: boolean;
  defaultOpen?: boolean;
};

function asIntegrationId(value: string): AppIntegrationId | null {
  const allowed = ['meta', 'instagram', 'facebook', 'asset_library', 'shopify', 'klaviyo', 'gmail', 'twilio', 'custom_api'];
  return allowed.includes(value) ? value as AppIntegrationId : null;
}

function defaultSettingsName(appName: string) {
  const lower = appName.toLowerCase();
  if (lower.includes('content studio')) return 'Studio settings';
  if (lower.includes('customer') || lower.includes('support')) return 'Support settings';
  if (lower.includes('email')) return 'Email settings';
  if (lower.includes('stock') || lower.includes('inventory')) return 'Stock settings';
  if (lower.includes('performance')) return 'Performance settings';
  if (lower.includes('instagram')) return 'Instagram settings';
  if (lower.includes('ad')) return 'Ad settings';
  if (lower.includes('review')) return 'Review settings';
  if (lower.includes('affiliate') || lower.includes('creator')) return 'Creator settings';
  if (lower.includes('pricing')) return 'Pricing settings';
  return `${appName} settings`;
}

export default function AppSettingsPanel(props: Props) {
  const resolvedAppId = props.appId || props.appKey || 'custom-request';
  const appDefinition = getAppDefinition(resolvedAppId);
  const fallback = getDefaultAppSettings(resolvedAppId);
  const configuredIntegrations = (props.integrations || []).map(item => asIntegrationId(item.provider)).filter(Boolean) as AppIntegrationId[];

  const [open, setOpen] = useState(Boolean(props.defaultOpen));
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [settings, setSettings] = useState<AppSettings>({ ...fallback, dir: props.directory || fallback.dir, integrations: configuredIntegrations.length ? configuredIntegrations : fallback.integrations });
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('');

  const tenantId = props.tenantId || session?.tenantId || session?.email || '';
  const appName = props.appName || props.title || appDefinition?.title || resolvedAppId.replace(/-/g, ' ');
  const settingsName = props.settingsName || defaultSettingsName(appName);
  const directory = settings.dir || props.directory || appDefinition?.dir || fallback.dir;
  const settingsHref = props.settingsHref || '/dashboard/settings';

  useEffect(() => {
    fetchSession().then(fresh => {
      if (fresh) setSession(fresh);
    });
  }, []);

  useEffect(() => {
    if (props.defaultOpen) setOpen(true);
  }, [props.defaultOpen]);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/app-settings?tenant_id=${encodeURIComponent(tenantId)}&app_id=${encodeURIComponent(resolvedAppId)}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.settings) {
          setSettings({
            ...fallback,
            ...data.settings,
            dir: data.settings.dir || props.directory || fallback.dir,
            integrations: Array.isArray(data.settings.integrations) ? data.settings.integrations : fallback.integrations,
          });
        }
      })
      .catch(() => undefined);
  }, [tenantId, resolvedAppId]);

  async function saveSettings() {
    setSaving(true);
    setSaveState('');
    try {
      const res = await fetch('/api/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: resolvedAppId, tenant_id: tenantId, settings: { ...settings, dir: directory } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      if (data.settings) setSettings(data.settings);
      setSaveState('Saved');
    } catch (err) {
      setSaveState(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`rounded-[22px] border border-blue-100 bg-white shadow-sm ${props.compact ? 'p-4' : 'p-5'} mb-5`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-blue-600">{settingsName}</div>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">{props.description || `Manage the ${appName.toLowerCase()} setup for this workspace.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700">{directory}</span>
          <button type="button" onClick={() => setOpen(value => !value)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">{open ? 'Close' : `Configure ${settingsName.replace(' settings', '')}`}</button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[0.85fr_1fr_0.65fr] gap-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Module directory</label>
            <input value={settings.dir} onChange={event => setSettings(current => ({ ...current, dir: event.target.value }))} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-500 mt-2">Where this module lives in the dashboard.</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Module notes</label>
            <textarea value={settings.notes || ''} onChange={event => setSettings(current => ({ ...current, notes: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Module-specific rules, content source, workflow notes, or preferences" />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Actions</div>
            <div className="mt-3 flex flex-col gap-2">
              <Link href={directory} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs font-bold text-blue-700 hover:bg-blue-100">Open module</Link>
              {props.setupHref && <Link href={props.setupHref} className="rounded-xl bg-[#3b82f6] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#2563eb]">Open setup</Link>}
              <Link href={settingsHref} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-xs font-bold text-gray-800 hover:bg-gray-50">Global settings</Link>
              <button type="button" onClick={saveSettings} disabled={saving || !tenantId} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
              {saveState && <div className={`text-xs font-bold ${saveState === 'Saved' ? 'text-green-700' : 'text-red-700'}`}>{saveState}</div>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
