'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchSession } from './session';
import type { BrandProfile } from './brand-profile';

export const BRAND_PROFILE_CHANGED_EVENT = 'ainomiq:brand-profile-changed';

type CacheEntry = { profile: BrandProfile | null; fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<BrandProfile | null>>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchProfile(tenantId: string): Promise<BrandProfile | null> {
  if (!tenantId) return null;
  const cached = cache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.profile;
  }
  const existing = inflight.get(tenantId);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const res = await fetch(
        `/api/settings/brand-profile?tenant_id=${encodeURIComponent(tenantId)}`,
        { cache: 'no-store', credentials: 'include' },
      );
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({ profile: null }));
      const profile: BrandProfile | null = data?.profile ?? null;
      cache.set(tenantId, { profile, fetchedAt: Date.now() });
      return profile;
    } catch {
      return null;
    } finally {
      inflight.delete(tenantId);
    }
  })();
  inflight.set(tenantId, promise);
  return promise;
}

/** Force every subscriber to refetch. Call after Settings saves/scrapes. */
export function emitBrandProfileChanged() {
  if (typeof window === 'undefined') return;
  cache.clear();
  window.dispatchEvent(new CustomEvent(BRAND_PROFILE_CHANGED_EVENT));
}

export type UseBrandProfileResult = {
  profile: BrandProfile | null;
  loading: boolean;
  tenantId: string;
  refresh: () => void;
};

/**
 * Shared hook so any module can read the central brand profile with one line.
 * Backed by a small in-memory cache + a custom event so Settings updates
 * propagate to every consumer (Sidebar, Content Studio, etc.) instantly.
 */
export function useBrandProfile(): UseBrandProfileResult {
  const [tenantId, setTenantId] = useState('');
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchSession()
      .then((session) => {
        if (!alive) return;
        const next = session?.tenantId || session?.email || '';
        setTenantId(next);
      })
      .catch(() => {
        if (alive) setTenantId('');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchProfile(tenantId).then((next) => {
      if (!alive) return;
      setProfile(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [tenantId, revision]);

  useEffect(() => {
    const handler = () => setRevision((value) => value + 1);
    window.addEventListener(BRAND_PROFILE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(BRAND_PROFILE_CHANGED_EVENT, handler);
  }, []);

  const refresh = useCallback(() => {
    cache.delete(tenantId);
    setRevision((value) => value + 1);
  }, [tenantId]);

  return { profile, loading, tenantId, refresh };
}
