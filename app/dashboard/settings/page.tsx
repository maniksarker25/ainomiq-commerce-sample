'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { 
  Settings2, 
  Globe, 
  Bell, 
  User, 
} from 'lucide-react';
import { PillTabBar } from '@/components/PillTabBar';

// lib imports
import { getSession, getSessionTenantId } from '../../../lib/session';
import { emitBrandProfileChanged } from '../../../lib/use-brand-profile';
import {
  BRAND_DATA_LEAVE_MESSAGE,
  setBrandDataDraftDirty,
} from '../../../lib/brand-data-draft-guard';

// local lib imports
import { SettingsTab, BrandProfile, ChatMsg, IntegrationStatus } from './_lib/types';
import { 
  EMPTY_BRAND_PROFILE, 
  INTEGRATION_DEFS, 
  NAV_HIDDEN_KEY, 
  NAV_ORDER_KEY, 
  NOTIF_EMAILS_KEY, 
  NOTIF_ALERTS_KEY,
  ALL_NAV_ITEMS
} from './_lib/constants';
import { 
  integrationProviderId, 
  connectionForIntegration, 
  disconnectPathForIntegration, 
  uniqueAssets, 
  sameAsset 
} from './_lib/utils';
import { serializeBrandProfileForCompare } from './_lib/brand-profile-compare';

// local component imports
import { PageHeader } from './_components/Typography';
import { IntegrationsTab } from './_components/IntegrationsTab';
import { BrandDataTab } from './_components/BrandDataTab';
import { NotificationsTab } from './_components/NotificationsTab';
import { AccountTab } from './_components/AccountTab';
import { AdAccountSelector } from './_components/AdAccountSelector';
import { SupportChat } from './_components/SupportChat';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const session = getSession();
  
  // -- State --
  const [activeTab, setActiveTab] = useState<SettingsTab>('integrations');
  const [shopifyInstallHint, setShopifyInstallHint] = useState(false);
  const [hiddenNav, setHiddenNav] = useState<string[]>([]);
  const [navOrder, setNavOrder] = useState<string[]>(ALL_NAV_ITEMS.map(i => i.id));
  const [notifEmails, setNotifEmails] = useState<string[]>(['', '']);
  const [notifAlerts, setNotifAlerts] = useState<Record<string, number[]>>({});
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: "Hey! Welcome to Ainomiq support. Pick a topic or type your question.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), suggestions: ['Getting Started', 'Stock Management', 'Ad Monitoring', 'Billing & Pricing', 'Report a Bug'] },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const brandScannerRef = useRef<HTMLDivElement>(null);
  const brandWebsiteInputRef = useRef<HTMLInputElement>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile>(EMPTY_BRAND_PROFILE);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandScraping, setBrandScraping] = useState(false);
  const [scanTick, setScanTick] = useState(0);
  const [brandSourceOpen, setBrandSourceOpen] = useState(false);
  const [brandEditorExpanded, setBrandEditorExpanded] = useState(false);
  const [brandDeleteConfirm, setBrandDeleteConfirm] = useState(false);
  const [brandDeleting, setBrandDeleting] = useState(false);
  const [hasPersistedBrand, setHasPersistedBrand] = useState(false);
  const savedBrandSnapshotRef = useRef('');
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>(
    INTEGRATION_DEFS.map(d => ({ ...d, connected: false, email: '', connectedProvider: integrationProviderId(d.id) }))
  );
  const [openIntegrationGroups, setOpenIntegrationGroups] = useState<Record<string, boolean>>({ internal: true, google: false, meta: false, social: false });
  
  // Ad account selector state
  const [showAdAccountSelector, setShowAdAccountSelector] = useState(false);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [adAccountsLoading, setAdAccountsLoading] = useState(false);
  const [selectedAdAccounts, setSelectedAdAccounts] = useState<string[]>([]);
  const [savingAdAccount, setSavingAdAccount] = useState(false);

  const hasBrandData = Boolean(brandProfile.source_summary);
  const activeScanStep = Math.min(3, Math.floor(scanTick / 5));
  const scanProgressPercent = brandScraping
    ? Math.min(96, Math.round(((activeScanStep + 1) / 4) * 100))
    : 0;

  const brandIsDirty = useMemo(() => {
    if (!hasBrandData) return false;
    return serializeBrandProfileForCompare(brandProfile) !== savedBrandSnapshotRef.current;
  }, [brandProfile, hasBrandData]);

  const brandSaveDisabled =
    !hasBrandData || !brandIsDirty || brandSaving || brandDeleting;

  const brandSaveLabel = useMemo(() => {
    if (brandSaving) return hasPersistedBrand ? 'Updating...' : 'Saving...';
    return hasPersistedBrand ? 'Update brand data' : 'Save brand data';
  }, [brandSaving, hasPersistedBrand]);

  const syncSavedBrandSnapshot = useCallback((profile: BrandProfile, persisted: boolean) => {
    savedBrandSnapshotRef.current = serializeBrandProfileForCompare(profile);
    setHasPersistedBrand(persisted);
  }, []);

  // -- Effects --
  useEffect(() => {
    if (searchParams.get('tab') === 'integrations') setActiveTab('integrations');
    if (searchParams.get('shopify_install_via') === 'app_store') {
      setShopifyInstallHint(true);
      setActiveTab('integrations');
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const hidden = localStorage.getItem(NAV_HIDDEN_KEY);
      if (hidden) setHiddenNav(JSON.parse(hidden));
      const order = localStorage.getItem(NAV_ORDER_KEY);
      if (order) {
        const parsed = JSON.parse(order) as string[];
        const all = ALL_NAV_ITEMS.map(i => i.id);
        const merged = [...parsed.filter((id: string) => all.includes(id)), ...all.filter(id => !parsed.includes(id))];
        setNavOrder(merged);
      }
      const emails = localStorage.getItem(NOTIF_EMAILS_KEY);
      if (emails) setNotifEmails(JSON.parse(emails));
      const alerts = localStorage.getItem(NOTIF_ALERTS_KEY);
      if (alerts) setNotifAlerts(JSON.parse(alerts));

      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get('tab') as SettingsTab | null;
      if (requestedTab && ['integrations', 'brand-data', 'notifications', 'account'].includes(requestedTab)) {
        setActiveTab(requestedTab);
      }
      if (requestedTab === 'brand-data' && params.get('action') === 'scan') {
        toast.info('Add or confirm your website, then run Analyze business.');
        window.setTimeout(() => {
          brandScannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          brandWebsiteInputRef.current?.focus();
        }, 150);
      }

      const selectAdAccount = params.get('select_ad_account');
      if (selectAdAccount === 'meta') {
        setShowAdAccountSelector(true);
        fetchAdAccounts();
      }

      // Fetch real integration status
      const s = getSession();
      if (s) {
        fetch(`/api/integrations?tenant_id=${encodeURIComponent(s.tenantId || s.email)}&_t=${Date.now()}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => {
            const integrationRows = (data.integrations || []) as Array<{ provider: string; email?: string; scopes?: string; providerAccountId?: string }>;
            
            // Parse existing selected ad accounts:
            const metaRow = integrationRows.find(ig => ig.provider === 'meta');
            if (metaRow?.providerAccountId) {
              setSelectedAdAccounts(metaRow.providerAccountId.split(',').filter(Boolean));
            }

            setIntegrations(INTEGRATION_DEFS.map(d => {
              const status = connectionForIntegration(d.id, integrationRows);
              return {
                ...d,
                connected: status.connected,
                email: status.email,
                connectedProvider: status.provider,
                providerAccountId: status.providerAccountId,
              } as IntegrationStatus;
            }));
          })
          .catch(() => {});

        const brandIds = Array.from(new Set([s.tenantId, s.email].filter(Boolean)));
        Promise.all(brandIds.map(id =>
          fetch(`/api/settings/brand-profile?tenant_id=${encodeURIComponent(id)}`, { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { profile: null })
            .catch(() => ({ profile: null }))
        ))
          .then(results => {
            const found = results.find(data => data.profile)?.profile;
            if (found) {
              const loaded = { ...EMPTY_BRAND_PROFILE, ...found };
              setBrandProfile(loaded);
              syncSavedBrandSnapshot(loaded, true);
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!brandScraping) {
      setScanTick(0);
      return;
    }
    const timer = window.setInterval(() => setScanTick(tick => tick + 1), 520);
    return () => window.clearInterval(timer);
  }, [brandScraping]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    setBrandDataDraftDirty(brandIsDirty);
    return () => setBrandDataDraftDirty(false);
  }, [brandIsDirty]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!brandIsDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [brandIsDirty]);

  const requestTabChange = (tab: SettingsTab) => {
    if (
      activeTab === 'brand-data' &&
      tab !== 'brand-data' &&
      brandIsDirty
    ) {
      const leave = window.confirm(BRAND_DATA_LEAVE_MESSAGE);
      if (!leave) return;
    }
    setActiveTab(tab);
  };

  // -- Actions --
  const fetchAdAccounts = async () => {
    const s = getSession();
    if (!s) return;
    setAdAccountsLoading(true);
    try {
      const res = await fetch(`/api/auth/meta/ad-accounts?tenant_id=${encodeURIComponent(s.tenantId || s.email)}`);
      const data = await res.json();
      setAdAccounts(data.accounts || []);
    } catch { /* ignore */ }
    setAdAccountsLoading(false);
  };

  const saveAdAccount = async () => {
    if (selectedAdAccounts.length === 0) return;
    const s = getSession();
    if (!s) return;
    setSavingAdAccount(true);
    try {
      await fetch('/api/auth/meta/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: s.tenantId || s.email, adAccountIds: selectedAdAccounts }),
      });
      setShowAdAccountSelector(false);
      window.history.replaceState({}, '', '/dashboard/settings');
      location.reload();
    } catch { /* ignore */ }
    setSavingAdAccount(false);
  };

  const toggleNavItem = (id: string) => {
    const item = ALL_NAV_ITEMS.find(n => n.id === id);
    if (item?.alwaysOn) return;
    const updated = hiddenNav.includes(id)
      ? hiddenNav.filter(x => x !== id)
      : [...hiddenNav, id];
    setHiddenNav(updated);
    localStorage.setItem(NAV_HIDDEN_KEY, JSON.stringify(updated));
  };

  const moveNavItem = (id: string, direction: 'up' | 'down') => {
    const idx = navOrder.indexOf(id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= navOrder.length) return;
    const updated = [...navOrder];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setNavOrder(updated);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(updated));
  };

  const sendChat = async (overrideMsg?: string) => {
    const msg = (overrideMsg || chatInput).trim();
    if (!msg || chatLoading) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMsg = { role: 'user', text: msg, time: now };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json();
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply || "Sorry, something went wrong. Try again in a moment.",
        time: replyTime,
        links: data.links || undefined,
        suggestions: data.suggestions || undefined,
        rated: null,
      }]);
    } catch {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [...prev, { role: 'assistant', text: "Connection issue, try again in a sec.", time: replyTime }]);
    }
    setChatLoading(false);
  };

  const rateMessage = (idx: number, rating: 'up' | 'down') => {
    setChatMessages(prev => prev.map((m, i) => i === idx ? { ...m, rated: rating } : m));
  };

  const saveBrandProfile = async () => {
    const s = getSession();
    if (!s) return;
    setBrandSaving(true);
    setBrandDeleteConfirm(false);
    const wasUpdate = hasPersistedBrand;
    try {
      const res = await fetch('/api/settings/brand-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: s.tenantId || s.email, ...brandProfile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const saved = { ...EMPTY_BRAND_PROFILE, ...data.profile };
      setBrandProfile(saved);
      syncSavedBrandSnapshot(saved, true);
      toast.success(
        wasUpdate
          ? 'Brand data updated. Automations will use the latest profile.'
          : 'Brand data saved. Automations can use this profile.',
      );
      emitBrandProfileChanged();
      setBrandEditorExpanded(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBrandSaving(false);
    }
  };

  const deleteBrandProfile = async () => {
    if (!brandDeleteConfirm) {
      setBrandDeleteConfirm(true);
      toast.warning('Click delete again to remove all brand data.');
      return;
    }
    const s = getSession();
    if (!s) return;
    setBrandDeleting(true);
    try {
      const res = await fetch('/api/settings/brand-profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: s.tenantId || s.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setBrandProfile(EMPTY_BRAND_PROFILE);
      syncSavedBrandSnapshot(EMPTY_BRAND_PROFILE, false);
      setBrandSourceOpen(false);
      setBrandDeleteConfirm(false);
      setBrandEditorExpanded(false);
      toast.success('Brand data deleted. Run a new scan to rebuild your profile.');
      emitBrandProfileChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBrandDeleting(false);
    }
  };

  const scrapeBrandWebsite = async () => {
    const s = getSession();
    if (!s || !brandProfile.website.trim()) return;
    const normalizedWebsite = /^https?:\/\//i.test(brandProfile.website.trim()) ? brandProfile.website.trim() : `https://${brandProfile.website.trim()}`;
    setBrandScraping(true);
    setBrandDeleteConfirm(false);
    setBrandEditorExpanded(true);
    try {
      const res = await fetch('/api/settings/brand-profile/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: s.tenantId || s.email, website: normalizedWebsite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Website scan failed');
      const draft = data.draft || data.profile;
      if (!draft) throw new Error('Scan completed but no draft was returned.');
      setBrandProfile({
        ...EMPTY_BRAND_PROFILE,
        ...draft,
        website: draft.website || normalizedWebsite,
        status: 'draft',
      });
      setBrandSourceOpen(true);
      toast.success('Scan complete. Review the draft, then save your brand data.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Website scan failed');
    } finally {
      setBrandScraping(false);
    }
  };

  const updateBrandProfile = (key: keyof BrandProfile, value: string) => {
    setBrandDeleteConfirm(false);
    setBrandProfile(current => ({ ...current, [key]: value }));
  };

  const handleBrandAssetUpload = (key: 'icon_url' | 'full_logo_url' | 'logo_url', file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      updateBrandProfile(key, value);
      if (key === 'full_logo_url') updateBrandProfile('logo_url', value);
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'integrations' as const, label: 'Integrations', icon: Settings2 },
    { id: 'brand-data' as const, label: 'Brand Data', shortLabel: 'Brand', icon: Globe },
    { id: 'notifications' as const, label: 'Notifications', shortLabel: 'Alerts', icon: Bell },
    { id: 'account' as const, label: 'Account', icon: User },
  ];

  return (
    <div className="mx-auto min-w-0 max-w-7xl">
      <PageHeader 
        title="General Settings" 
        description="Manage integrations, Brand Data and account preferences for all modules." 
      />

      <PillTabBar
        tabs={tabs}
        activeId={activeTab}
        onChange={requestTabChange}
        ariaLabel="General Settings"
      />

      {/* Tab Content */}
      {activeTab === 'integrations' && (
        <IntegrationsTab 
          integrations={integrations}
          openIntegrationGroups={openIntegrationGroups}
          setOpenIntegrationGroups={setOpenIntegrationGroups}
          shopifyInstallHint={shopifyInstallHint}
          session={session}
          onViewDetails={(id) => {
            if (id === 'meta_ads') {
              setShowAdAccountSelector(true);
              fetchAdAccounts();
            }
          }}
        />
      )}

      {activeTab === 'brand-data' && (
        <BrandDataTab 
          brandScannerRef={brandScannerRef}
          brandWebsiteInputRef={brandWebsiteInputRef}
          brandProfile={brandProfile}
          brandScraping={brandScraping}
          brandSaving={brandSaving}
          brandDeleting={brandDeleting}
          brandDeleteConfirm={brandDeleteConfirm}
          brandSourceOpen={brandSourceOpen}
          setBrandSourceOpen={setBrandSourceOpen}
          activeScanStep={activeScanStep}
          scanProgressPercent={scanProgressPercent}
          brandIsDirty={brandIsDirty}
          hasPersistedBrand={hasPersistedBrand}
          brandSaveDisabled={brandSaveDisabled}
          brandSaveLabel={brandSaveLabel}
          hasBrandData={hasBrandData}
          scrapeBrandWebsite={scrapeBrandWebsite}
          saveBrandProfile={saveBrandProfile}
          deleteBrandProfile={deleteBrandProfile}
          updateBrandProfile={updateBrandProfile}
          handleBrandAssetUpload={handleBrandAssetUpload}
          setBrandDeleteConfirm={setBrandDeleteConfirm}
          brandEditorExpanded={brandEditorExpanded}
          setBrandEditorExpanded={setBrandEditorExpanded}
        />
      )}

      {activeTab === 'notifications' && (
        <NotificationsTab 
          notifEmails={notifEmails}
          setNotifEmails={setNotifEmails}
          notifAlerts={notifAlerts}
          setNotifAlerts={setNotifAlerts}
        />
      )}

      {activeTab === 'account' && (
        <AccountTab 
          session={session}
          navOrder={navOrder}
          hiddenNav={hiddenNav}
          toggleNavItem={toggleNavItem}
          moveNavItem={moveNavItem}
        />
      )}

      {/* Modals & Legacy Support */}
      {showAdAccountSelector && (
        <AdAccountSelector 
          adAccountsLoading={adAccountsLoading}
          adAccounts={adAccounts}
          selectedAdAccounts={selectedAdAccounts}
          setSelectedAdAccounts={setSelectedAdAccounts}
          savingAdAccount={savingAdAccount}
          saveAdAccount={saveAdAccount}
          closeSelector={() => { setShowAdAccountSelector(false); window.history.replaceState({}, '', '/dashboard/settings'); }}
        />
      )}

      {process.env.NEXT_PUBLIC_SHOW_LEGACY_SUPPORT === '1' && (
        <div className="mt-12">
          <PageHeader title="Support" description="Get help from our team or AI assistant." />
          <SupportChat 
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatLoading={chatLoading}
            sendChat={sendChat}
            chatEndRef={chatEndRef}
            rateMessage={rateMessage}
          />
        </div>
      )}
    </div>
  );
}
