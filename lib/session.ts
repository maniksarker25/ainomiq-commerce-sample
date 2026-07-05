// Session management - JWT HttpOnly cookie based
// The JWT cookie is set/cleared server-side. Client components fetch session data via /api/auth/session.

const SESSION_CACHE_KEY = "ainomiq_session_cache";

/** Fired when `fetchSession` loads a new session so mounted UI (e.g. Sidebar) can update without a full reload. */
export const SESSION_CHANGED_EVENT = "ainomiq-session-changed";

function dispatchSessionChanged(session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(SESSION_CHANGED_EVENT, { detail: session }),
    );
  } catch {}
}

export interface Session {
  tenantId: string;
  email: string;
  name: string;
  organization: string;
  modules: string[];
  accessMode?: "customer" | "creative-editor";
}

// Get cached session from sessionStorage (fast, survives page navigations within tab)
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

// Cache session data in sessionStorage (NOT for auth - just for UI display)
export function cacheSession(session: Session) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    dispatchSessionChanged(session);
  } catch {}
}

// Clear cached session
export function clearSessionCache() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    // Also clear legacy localStorage
    localStorage.removeItem("ainomiq_session");
    dispatchSessionChanged(null);
  } catch {}
}

// Fetch session from server (verifies JWT cookie server-side)
export async function fetchSession(): Promise<Session | null> {
  try {
    const res = await fetch(`/api/auth/session?t=${Date.now()}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401) clearSessionCache();
      return null;
    }
    const data = await res.json();
    if (data.session) {
      cacheSession(data.session);
      return data.session;
    }
    return null;
  } catch {
    return null;
  }
}

// Logout: call server to clear cookie, then redirect
export async function logout() {
  clearSessionCache();
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {}
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export { getSessionTenantId } from "./tenant-id";
