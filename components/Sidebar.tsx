'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { fetchSession, logout, SESSION_CHANGED_EVENT, type Session } from '../lib/session';
import {
  BRAND_DATA_DIRTY_CHANGED_EVENT,
  confirmLeaveBrandDataDraft,
  getBrandDataDraftDirty,
  shouldConfirmBrandDataSidebarNavigation,
} from '../lib/brand-data-draft-guard';

const NAV_HIDDEN_KEY = 'ainomiq_nav_hidden';
const NAV_ORDER_KEY = 'ainomiq_nav_order';
const SIDEBAR_COLLAPSED_KEY = 'ainomiq_sidebar_collapsed';

const MODULE_NAV: Record<string, { name: string; href: string; icon: string }> = {
  stock: {
    name: 'Stock Management',
    href: '/dashboard/stock',
    icon: '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  },
  cs: {
    name: 'Intelli Support',
    href: '/dashboard/cs',
    icon: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  },
  content: {
    name: 'Content Studio',
    href: '/dashboard/content-pipeline',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M13 3v6h6"/><path d="M8 14h8"/><path d="M8 18h5"/></svg>',
  },
  ads: {
    name: 'Logic Ads',
    href: '/dashboard/ads',
    icon: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M8 17v-4"/><path d="M13 17V8"/><path d="M18 17v-7"/></svg>',
  },
  'creative-os': {
    name: 'Creative OS',
    href: '/dashboard/creative-os',
    icon: '<svg viewBox="0 0 24 24"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 12.5-9.17 4.18a2 2 0 0 1-1.66 0L2 12.5"/><path d="m22 17.5-9.17 4.18a2 2 0 0 1-1.66 0L2 17.5"/></svg>',
  },
  performance: {
    name: 'Performance',
    href: '/dashboard/performance',
    icon: '<svg viewBox="0 0 24 24"><path d="M23 6l-10 9.5L8 12l-5 4"/><path d="M17 6h6v6"/><path d="M18 15v6"/><path d="M21 18h-6"/></svg>',
  },
};

const AVAILABLE_MODULES = new Set(['performance', 'ads', 'creative-os', 'stock', 'cs', 'content']);

const ADD_AUTOMATIONS_NAV = {
  name: 'Automations',
  href: '/dashboard/automations',
  icon: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
};

export default function Sidebar() {
  const [session, setSession] = useState<Session | null>(null);
  const [adsReady, setAdsReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [hiddenNav, setHiddenNav] = useState<string[]>([]);
  const [navOrder, setNavOrder] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [brandDraftDirty, setBrandDraftDirty] = useState(false);

  const handleSidebarNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!shouldConfirmBrandDataSidebarNavigation(href, pathname ?? '')) return;
    event.preventDefault();
    if (confirmLeaveBrandDataDraft()) {
      router.push(href);
    }
  };

  const guardExternalLeave = (navigate: () => void) => {
    if (pathname?.startsWith('/dashboard/settings') && brandDraftDirty) {
      if (!confirmLeaveBrandDataDraft()) return;
    }
    navigate();
  };

  useEffect(() => {
    const onSessionChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<Session | null>).detail;
      setSession(detail ?? null);
    };
    window.addEventListener(SESSION_CHANGED_EVENT, onSessionChanged);

    fetchSession().then(fresh => {
      setSession(fresh);
    });

    const sync = () => {
      try {
        const hidden = localStorage.getItem(NAV_HIDDEN_KEY);
        setHiddenNav(hidden ? JSON.parse(hidden) : []);
        const order = localStorage.getItem(NAV_ORDER_KEY);
        setNavOrder(order ? JSON.parse(order) : []);
        setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
      } catch {}
    };
    sync();
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 1000);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
      window.removeEventListener('storage', sync);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setAdsReady(true);
  }, []);

  useEffect(() => {
    setBrandDraftDirty(getBrandDataDraftDirty());
    const onDirtyChanged = (event: Event) => {
      setBrandDraftDirty(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(BRAND_DATA_DIRTY_CHANGED_EVENT, onDirtyChanged);
    return () =>
      window.removeEventListener(BRAND_DATA_DIRTY_CHANGED_EVENT, onDirtyChanged);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--dashboard-sidebar-width', collapsed ? '72px' : '256px');
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  if (!session) return null;

  const enabledModules = new Set((session.modules || []).filter(m => AVAILABLE_MODULES.has(m)));
  if (enabledModules.has('ads')) enabledModules.add('creative-os');
  if (enabledModules.has('ads') && !adsReady) enabledModules.delete('ads');
  const additionalModules = Array.from(enabledModules).filter(
    (m: string) => MODULE_NAV[m] && m !== 'performance'
  );

  const navItems = [
    // Include other modules from session
    ...additionalModules.flatMap((m: string) => {
      if (m === 'cs') {
        return [{ ...MODULE_NAV.cs, exact: false }];
      }
      return MODULE_NAV[m] ? [{ ...MODULE_NAV[m], exact: false }] : [];
    }),
    { ...MODULE_NAV.performance, exact: false },
  ];
  const visibleNavItems = session.accessMode === 'creative-editor'
    ? [{ ...MODULE_NAV['creative-os'], exact: false }]
    : navItems;

  const settingsItem = {
    name: 'General Settings',
    href: '/dashboard/settings',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Map nav item hrefs to IDs for hiding
  const getNavId = (href: string) => {
    if (href === '/dashboard/automations') return 'add-automations';
    if (href === '/dashboard/settings') return 'settings';
    // Module nav items: stock, cs, ads
    const mod = Object.entries(MODULE_NAV).find(([, v]) => v.href === href);
    return mod ? mod[0] : '';
  };

  const unorderedItems = [...visibleNavItems, ...(session.accessMode === 'creative-editor' ? [] : [{ ...settingsItem, exact: false }])]
    .filter(item => !hiddenNav.includes(getNavId(item.href)));

  // Sort by saved order if available
  const allBottomItems = navOrder.length > 0
    ? unorderedItems.sort((a, b) => {
        const ai = navOrder.indexOf(getNavId(a.href));
        const bi = navOrder.indexOf(getNavId(b.href));
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
    : unorderedItems;

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <div className={`sidebar hidden md:flex fixed left-0 top-0 h-screen flex-col transition-[width] duration-200 ${collapsed ? 'sidebar-collapsed' : ''}`} style={{ width: collapsed ? 72 : 256 }}>
        {/* Logo */}
        <div className={`flex items-center py-6 ${collapsed ? 'justify-center px-3' : 'justify-between px-6'}`}>
          <Link
            href="/dashboard"
            style={{ textDecoration: 'none' }}
            onClick={(e) => handleSidebarNavClick(e, '/dashboard')}
          >
            {collapsed ? (
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white">
                <img src="/ainomiq-icon.png?v=1" alt="ainomiq" className="h-8 w-8 object-contain" />
              </span>
            ) : (
              <img src="/ainomiq-logo.png?v=1" alt="ainomiq" style={{ height: '24px', width: 'auto' }} />
            )}
          </Link>
          {!collapsed ? (
            <button type="button" onClick={() => setCollapsed(true)} className="sidebar-toggle" aria-label="Collapse sidebar" title="Collapse sidebar">
              <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          ) : null}
        </div>
        {collapsed ? (
          <button type="button" onClick={() => setCollapsed(false)} className="sidebar-toggle mx-auto mb-2" aria-label="Expand sidebar" title="Expand sidebar">
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ) : null}

        {/* Navigation */}
        <nav className={`mt-2 flex-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          <div className="space-y-1">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive(item.href, item.exact) ? 'active' : ''}`}
                title={collapsed ? item.name : undefined}
                onClick={(e) => handleSidebarNavClick(e, item.href)}
              >
                <span dangerouslySetInnerHTML={{ __html: item.icon }} style={{ width: 20, height: 20, display: 'flex' }} />
                <span className="sidebar-label">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Add actions + Settings + Support below the line */}
          {session.accessMode !== 'creative-editor' ? <div className="mt-8 pt-4 space-y-1" style={{ borderTop: '1px solid #e2e6ef' }}>
            <Link
              href={ADD_AUTOMATIONS_NAV.href}
              className={`sidebar-link ${isActive(ADD_AUTOMATIONS_NAV.href, true) ? 'active' : ''}`}
              title={collapsed ? ADD_AUTOMATIONS_NAV.name : undefined}
            >
              <span dangerouslySetInnerHTML={{ __html: ADD_AUTOMATIONS_NAV.icon }} style={{ width: 20, height: 20, display: 'flex' }} />
              <span className="sidebar-label">{ADD_AUTOMATIONS_NAV.name}</span>
            </Link>
            <Link
              href={settingsItem.href}
              className={`sidebar-link ${isActive(settingsItem.href) ? 'active' : ''}`}
              title={collapsed ? settingsItem.name : undefined}
              onClick={(e) => handleSidebarNavClick(e, settingsItem.href)}
            >
              <span dangerouslySetInnerHTML={{ __html: settingsItem.icon }} style={{ width: 20, height: 20, display: 'flex' }} />
              <span className="sidebar-label">{settingsItem.name}</span>
            </Link>
            <Link
              href="/dashboard/support"
              className={`sidebar-link ${isActive('/dashboard/support') ? 'active' : ''}`}
              title={collapsed ? 'Support' : undefined}
              onClick={(e) => handleSidebarNavClick(e, '/dashboard/support')}
            >
              <span dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>' }} style={{ width: 20, height: 20, display: 'flex' }} />
              <span className="sidebar-label">Support</span>
            </Link>
          </div> : null}
        </nav>

        {/* User */}
        <div className={`${collapsed ? 'px-2' : 'px-4'} py-4`} style={{ borderTop: '1px solid #e2e6ef' }}>
          <div className={`mb-3 flex items-center gap-3 px-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#5b8def' }}>
              {session.name?.charAt(0) || '?'}
            </div>
            <div className="sidebar-label" style={{ minWidth: 0 }}>
              <p className="text-sm font-medium truncate" style={{ color: '#1a1a2e' }}>{session.name}</p>
              <p className="text-xs truncate" style={{ color: '#6b7280' }}>{session.organization}</p>
            </div>
          </div>
          <a
            href="https://www.ainomiq.com"
            className="sidebar-link"
            style={{ fontSize: '13px', textDecoration: 'none' }}
            title={collapsed ? 'Back to site' : undefined}
            onClick={(e) => {
              if (
                !shouldConfirmBrandDataSidebarNavigation(
                  'https://www.ainomiq.com',
                  pathname ?? '',
                )
              ) {
                return;
              }
              e.preventDefault();
              if (confirmLeaveBrandDataDraft()) {
                window.location.href = 'https://www.ainomiq.com';
              }
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', fill: 'none', strokeWidth: 1.5 }}>
              <path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            </svg>
            <span className="sidebar-label">Back to site</span>
          </a>
          <button
            onClick={() => guardExternalLeave(() => logout())}
            className="sidebar-link w-full text-left"
            style={{ fontSize: '13px' }}
            title={collapsed ? 'Sign out' : undefined}
          >
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', fill: 'none', strokeWidth: 1.5 }}>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="sidebar-label">Sign out</span>
          </button>
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="mobile-bottom-nav md:!hidden">
        {allBottomItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-tab ${active ? 'active' : ''}`}
              onClick={(e) => handleSidebarNavClick(e, item.href)}
            >
              {active && <span className="mobile-tab-indicator" />}
              <span dangerouslySetInnerHTML={{ __html: item.icon }} className="mobile-tab-icon" />
              <span className="mobile-tab-label">{item.name.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
